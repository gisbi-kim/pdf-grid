'use strict';

const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, nativeImage, protocol, session } = require('electron');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const pendingFiles = new Map();

const scheme = 'pdfgrid';
const origin = 'pdfgrid://app';
const root = path.join(__dirname, 'web');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};
const policy = [
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
  const pathname = decodeURIComponent(url.pathname);
  const name = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
  const relative = path.relative(root, name);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    return new Response(null, { status: 403 });
  }
  try {
    return new Response(await readFile(name), {
      headers: {
        'Content-Type': types[path.extname(name)] || 'application/octet-stream',
        'Content-Security-Policy': policy,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

app.whenReady().then(() => {
  protocol.handle(scheme, serve);
  session.defaultSession.webRequest.onBeforeRequest(({ url }, callback) => {
    callback({ cancel: ![origin + '/', 'blob:' + origin + '/'].some(prefix => url.startsWith(prefix)) });
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  ipcMain.handle('save-result', async (event, name, bytes) => {
    if (event.senderFrame?.url !== origin + '/dev/#merge' &&
        event.senderFrame?.url !== origin + '/dev/#split') {
      throw new Error('허용되지 않은 저장 요청입니다.');
    }
    if (typeof name !== 'string' || !/^[^<>:"/\\|?*\x00-\x1f]+\.(pdf|zip)$/i.test(name) ||
        !(bytes instanceof Uint8Array)) {
      throw new Error('저장할 파일 형식이 올바르지 않습니다.');
    }
    const extension = path.extname(name).slice(1).toLowerCase();
    const choice = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
      title: 'PDF Grid — 파일 저장',
      defaultPath: path.join(app.getPath('downloads'), name),
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (choice.canceled || !choice.filePath) return false;
    await writeFile(choice.filePath, bytes);
    return true;
  });

  ipcMain.handle('copy-pdf-image', (event, bytes) => {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame ||
        frame.url !== origin + '/dev/#viewer' || !(bytes instanceof Uint8Array) ||
        bytes.byteLength > 32 * 1024 * 1024) return false;
    const image = nativeImage.createFromBuffer(Buffer.from(bytes));
    if (image.isEmpty()) return false;
    clipboard.writeImage(image);
    return true;
  });
  ipcMain.handle('get-startup-pdf', async event => {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame ||
        frame.url.split('#')[0] !== origin + '/dev/') return null;
    const queue = pendingFiles.get(event.sender.id);
    while (queue?.length) {
      const filename = queue.shift();
      try {
        const bytes = await readFile(filename);
        return { name: path.basename(filename), bytes };
      } catch {
        dialog.showErrorBox('PDF Grid', 'PDF 파일을 읽을 수 없습니다. 파일이 이동했거나 열기 권한이 있는지 확인해 주세요.');
      }
    }
    return null;
  });
  Menu.setApplicationMenu(null);
});

function openWindow(files) {
  const window = new BrowserWindow({
    title: 'PDF Grid',
    icon: path.join(__dirname, 'pdf-grid.ico'),
    width: 1280,
    height: 850,
    minWidth: 640,
    minHeight: 450,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-frame-navigate', (event, details) => {
    const url = details?.url ?? event.url ?? details;
    if (typeof url === 'string' && !url.startsWith(origin + '/')) event.preventDefault();
  });
  const id = window.webContents.id;
  pendingFiles.set(id, files);
  window.on('closed', () => pendingFiles.delete(id));
  window.loadURL(origin + '/dev/');
  return window;
}

function openArguments(argv, workingDirectory) {
  const files = argv.slice(app.isPackaged ? 1 : 2)
    .filter(arg => !arg.startsWith('-') && path.extname(arg).toLowerCase() === '.pdf')
    .map(arg => path.resolve(workingDirectory, arg));
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) {
    openWindow(files);
    return;
  }
  pendingFiles.get(window.webContents.id).push(...files);
  if (files.length) window.webContents.send('pdf-open-requested');
  if (window.isMinimized()) window.restore();
  window.focus();
}

if (process.platform !== 'win32' || app.requestSingleInstanceLock()) {
  app.whenReady().then(() => openArguments(process.argv, process.cwd()));
  app.on('second-instance', (_event, argv, workingDirectory) => {
    app.whenReady().then(() => openArguments(argv, workingDirectory));
  });
} else {
  app.quit();
}
app.on('window-all-closed', () => app.quit());
