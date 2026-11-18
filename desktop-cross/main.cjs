'use strict';

const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, protocol, screen, session, shell } = require('electron');
const { randomUUID } = require('node:crypto');
const { constants, readFileSync, writeFileSync, renameSync, mkdirSync } = require('node:fs');
const { open, readFile, stat, writeFile } = require('node:fs/promises');
const path = require('node:path');

const scheme = 'pdfgrid';
const origin = 'pdfgrid://app';
const root = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.resolve(__dirname, '../desktop-webview2/web');
const shellURL = origin + '/dev/';
const maxPDFSize = 100 * 1024 * 1024;
const pendingFiles = [];
let window;
let quitting = false;
let initialized = false;
let sources = new Map();
const profile = app.commandLine.getSwitchValue('user-data-dir');
if (profile) {
  const directory = path.resolve(profile);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  app.setPath('userData', directory);
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};
const csp = [
  "default-src 'self' blob:",
  "script-src 'self' 'unsafe-inline' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([{
  scheme,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

async function serve(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.host !== 'app') return new Response(null, { status: 403 });
  const headers = { 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' };
  // The shared bundle loads the Windows bridge here. Electron installs its bridge in preload.
  if (url.pathname === '/_desktop/bridge.js') {
    return new Response('', { headers: { ...headers, 'Content-Type': types['.js'] } });
  }
  try {
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\\')) return new Response(null, { status: 403 });
    const filename = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    const relative = path.relative(root, filename);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      return new Response(null, { status: 403 });
    }
    headers['Content-Type'] = types[path.extname(filename)] || 'application/octet-stream';
    return new Response(await readFile(filename), { headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}

function readState(filename, fallback) {
  try {
    return JSON.parse(readFileSync(path.join(app.getPath('userData'), filename), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeState(filename, state) {
  const target = path.join(app.getPath('userData'), filename);
  writeFileSync(target + '.tmp', JSON.stringify(state), { mode: 0o600 });
  renameSync(target + '.tmp', target);
}

function isPDFPath(filename) {
  return typeof filename === 'string' && path.isAbsolute(filename) && /\.pdf$/i.test(filename);
}

function registerSource(filename) {
  if (!isPDFPath(filename)) return null;
  for (const [id, existing] of sources) {
    if (filename === existing) return id;
  }
  const id = randomUUID();
  const updated = new Map(sources).set(id, filename);
  writeState('sources.json', Object.fromEntries(updated));
  sources = updated;
  return id;
}

async function readSource(filename, sourceID) {
  if (!isPDFPath(filename)) throw new Error('원본 PDF를 다시 열어 주세요.');
  // Reject device files and large inputs before reading.
  if (!(await stat(filename)).isFile()) throw new Error('PDF 파일을 열 수 없습니다.');
  const file = await open(filename, constants.O_RDONLY | (constants.O_NONBLOCK || 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxPDFSize) throw new Error('100MB 이하의 PDF를 열어 주세요.');
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    return {
      name: path.basename(filename).normalize('NFC'),
      bytes: bytes.subarray(0, offset),
      sourceID: sourceID || registerSource(filename),
    };
  } catch (error) {
    throw new Error(error.code ? 'PDF 파일을 읽지 못했습니다.' : error.message);
  } finally {
    await file.close();
  }
}

function registerIPC(action, handler) {
  ipcMain.handle('pdf-grid:' + action, (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== event.sender.mainFrame ||
        event.senderFrame.url.split('#')[0] !== shellURL) {
      throw new Error('허용되지 않은 요청입니다.');
    }
    return handler(...args);
  });
}

function setupIPC() {
  registerIPC('next', async () => {
    while (pendingFiles.length) {
      try {
        return await readSource(pendingFiles.shift());
      } catch {
        dialog.showErrorBox('PDF Grid', 'PDF 파일을 열 수 없습니다. 파일 위치와 접근 권한을 확인해 주세요.');
      }
    }
    return null;
  });
  registerIPC('pick', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'PDF 열기',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    return result.canceled ? [] : Promise.all(result.filePaths.map(filename => readSource(filename)));
  });
  registerIPC('register', registerSource);
  registerIPC('refresh', id => readSource(sources.get(id), id));
  registerIPC('copy-path', id => {
    const filename = sources.get(id);
    if (!filename) return false;
    clipboard.writeText(filename);
    return true;
  });
  registerIPC('copy-image', bytes => {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > 32 * 1024 * 1024) return false;
    const image = nativeImage.createFromBuffer(Buffer.from(bytes));
    if (image.isEmpty()) return false;
    clipboard.writeImage(image);
    return true;
  });
  registerIPC('external', async value => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('웹 링크만 열 수 있습니다.');
    await shell.openExternal(url.href);
  });
  registerIPC('save', async (name, bytes) => {
    if (typeof name !== 'string' || !/^[^<>:"/\\|?*\x00-\x1f]+\.(pdf|zip)$/i.test(name) ||
        !(bytes instanceof Uint8Array)) throw new Error('저장할 파일 형식이 올바르지 않습니다.');
    const ext = path.extname(name).slice(1).toLowerCase();
    const choice = await dialog.showSaveDialog(window, {
      title: 'PDF Grid — 파일 저장',
      defaultPath: path.join(app.getPath('downloads'), name),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (choice.canceled || !choice.filePath) return false;
    await writeFile(choice.filePath, bytes);
    return true;
  });
}

function restoreBounds(bounds) {
  if (!bounds || !['x', 'y', 'width', 'height'].every(key => Number.isInteger(bounds[key]))) {
    return { width: 1280, height: 850 };
  }
  const area = screen.getDisplayMatching(bounds).workArea;
  const width = Math.max(640, Math.min(bounds.width, area.width));
  const height = Math.max(450, Math.min(bounds.height, area.height));
  return {
    width, height,
    x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)),
  };
}

function createWindow() {
  const state = readState('window.json', {}) || {};
  const opened = new BrowserWindow({
    title: 'PDF Grid',
    icon: path.join(__dirname, 'icon.png'),
    ...restoreBounds(state.bounds),
    show: false,
    minWidth: 640,
    minHeight: 450,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window = opened;
  opened.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  opened.webContents.on('will-navigate', event => event.preventDefault());
  opened.webContents.on('will-frame-navigate', event => {
    if (!event.url.startsWith(origin + '/')) event.preventDefault();
  });
  opened.once('ready-to-show', () => {
    if (state.maximized) opened.maximize();
    opened.show();
  });
  let closing = false;
  let flushed = false;
  opened.on('close', event => {
    if (flushed) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    try {
      writeState('window.json', { bounds: opened.getNormalBounds(), maximized: opened.isMaximized() });
    } catch (error) {
      console.error('Could not save window placement:', error.message);
    }
    let timeout;
    const deadline = new Promise(resolve => { timeout = setTimeout(resolve, 2000); });
    Promise.race([opened.webContents.executeJavaScript('window.PDFGridSession?.flush()'), deadline])
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        flushed = true;
        if (quitting) app.quit();
        else if (!opened.isDestroyed()) opened.close();
      });
  });
  opened.on('closed', () => { window = null; });
  void opened.loadURL(shellURL);
}

function enqueue(files) {
  pendingFiles.push(...files);
  if (!initialized) return;
  if (!window) createWindow();
  else {
    if (window.isMinimized()) window.restore();
    window.focus();
    if (files.length) window.webContents.send('pdf-grid:open-requested');
  }
}

function pdfArguments(argv, directory) {
  return argv.slice(app.isPackaged ? 1 : 2)
    .filter(arg => !arg.startsWith('-') && /\.pdf$/i.test(arg))
    .map(arg => path.resolve(directory, arg));
}

if (app.requestSingleInstanceLock()) {
  app.on('open-file', (event, filename) => {
    event.preventDefault();
    if (isPDFPath(filename)) enqueue([filename]);
  });
  app.on('second-instance', (_event, argv, directory) => enqueue(pdfArguments(argv, directory)));
  app.on('activate', () => { if (initialized && !window) createWindow(); });
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.whenReady().then(() => {
    sources = new Map(Object.entries(readState('sources.json', {}) || {}).filter(([, filename]) => isPDFPath(filename)));
    protocol.handle(scheme, serve);
    session.defaultSession.webRequest.onBeforeRequest(({ url }, callback) => {
      callback({ cancel: !url.startsWith(origin + '/') && !url.startsWith('blob:' + origin + '/') });
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    setupIPC();
    Menu.setApplicationMenu(process.platform === 'darwin'
      ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }])
      : null);
    initialized = true;
    enqueue(pdfArguments(process.argv, process.cwd()));
  }).catch(error => {
    dialog.showErrorBox('PDF Grid', error.message);
    app.exit(1);
  });
} else {
  app.quit();
}
