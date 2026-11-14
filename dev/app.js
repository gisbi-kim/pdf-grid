'use strict';
const $ = id => document.getElementById(id);
const lib = window.PDFLib, core = window.PDFGridTools;
let mergeFiles = [], splitFile = null, outputs = [], outputURLs = [], activeTab = 'merge', busy = false;
const MAX_BYTES = 100 * 1024 * 1024;
const GRID_VIEWER_URL = window.pdfGridDesktop ? '../?v=1.5.1' : '../viewer/?v=1.5.1';
function addGridSteppers(view) {
  const frame = view.defaultView;
  const columns = view.getElementById('cols');
  const totalRows = view.getElementById('rows');
  const gridGroup = columns.closest('.group');
  const rowInput = view.createElement('input');
  rowInput.type = 'number'; rowInput.min = '1'; rowInput.max = '10'; rowInput.value = '1'; rowInput.id = 'screenRows';
  rowInput.setAttribute('aria-label', '화면에 보이는 행 수');
  rowInput.title = '한 화면에 맞출 행 수. 전체 페이지는 아래로 계속 이어집니다.';
  function stepper(labelText, input, onChange) {
    const box = view.createElement('div'); box.className = 'gridStepper';
    const label = view.createElement('label'); label.htmlFor = input.id; label.textContent = labelText;
    const less = view.createElement('button'), more = view.createElement('button');
    less.type = more.type = 'button'; less.textContent = '−'; more.textContent = '+';
    less.setAttribute('aria-label', `${labelText} 줄이기`); more.setAttribute('aria-label', `${labelText} 늘리기`);
    less.title = `${labelText} 줄이기`; more.title = `${labelText} 늘리기`;
    const change = delta => { input.value = Math.max(1, Math.min(10, (Number(input.value) || 1) + delta)); onChange(); sync(); };
    less.onclick = () => change(-1); more.onclick = () => change(1);
    box.append(label, less, input, more);
    return {box, input, less, more};
  }
  const colStep = stepper('열', columns, () => columns.dispatchEvent(new frame.Event('change', {bubbles:true})));
  const applyRows = () => { frame.setGridViewportRows(Number(rowInput.value)); sync(); };
  const rowStep = stepper('화면 행', rowInput, applyRows);
  rowInput.onchange = applyRows;
  totalRows.hidden = true;
  gridGroup.replaceChildren(colStep.box, rowStep.box, totalRows);
  gridGroup.classList.add('gridDimensions');
  function sync() {
    const state = frame.gridViewportState();
    rowInput.value = state.rows;
    rowInput.disabled = !state.ready;
    colStep.less.disabled = Number(columns.value) <= 1;
    colStep.more.disabled = Number(columns.value) >= 10;
    rowStep.less.disabled = !state.ready || state.rows <= 1;
    rowStep.more.disabled = !state.ready || state.rows >= 10;
  }
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(view.getElementById('zoomLabel'), {childList:true});
  observer.observe(totalRows, {childList:true});
  columns.addEventListener('change', sync);
}


// Only the viewer embedded in DEV gets this layout. Moving the existing nodes
// preserves the viewer's file-open handlers and filename updates.
function compactGridViewer(frame) {
  const view = frame.contentDocument;
  if (!view || view.documentElement.classList.contains('embeddedGrid')) return;
  const toolbar = view.getElementById('toolbar');
  const filename = view.getElementById('filename');
  const open = view.getElementById('open');
  const file = view.getElementById('file');
  if (!toolbar || !filename || !open || !file) return;
  if (window.pdfGridDesktop?.pickPDFs) {
    open.onclick = view.getElementById('openEmpty').onclick = () => void window.pickPdfTabs();
  }
  window.PDFGridReload.bind(view);
  const group = view.createElement('div');
  group.className = 'group documentGroup';
  group.append(filename, open, file);
  toolbar.prepend(group);
  view.documentElement.classList.add('embeddedGrid');
  const style = view.createElement('style');
  style.textContent = `
    .embeddedGrid header { display:none }
    .embeddedGrid .toolbar {
      min-height: 38px;
      padding: 4px 9px;
      gap: 9px;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .embeddedGrid .group { gap: 4px; font-size: 12px; flex-shrink: 0 }
    .embeddedGrid button { padding: 3px 6px; font-size: 12px; min-height: 26px }
    .embeddedGrid input[type=number] { width: 36px; padding: 3px; font-size: 12px }
    .embeddedGrid #page { width: 40px }
    .embeddedGrid .gridDimensions { order: -3; gap: 8px }
    .embeddedGrid .gridStepper { display: flex; align-items: center; gap: 3px; white-space: nowrap }
    .embeddedGrid .gridStepper label { margin-right: 2px; color: #bdc7cf }
    .embeddedGrid .gridStepper button { width: 24px; padding: 1px; font-size: 14px }
    .embeddedGrid .gridStepper input { width: 30px; text-align: center; appearance: textfield }
    .embeddedGrid .gridStepper input::-webkit-inner-spin-button,
    .embeddedGrid .gridStepper input::-webkit-outer-spin-button { appearance: none; margin: 0 }
    .embeddedGrid .divider, .embeddedGrid .spacer, .embeddedGrid .toolbar > .group > .label { display: none }
    .embeddedGrid .documentGroup { order: -2; flex: 0 1 160px; min-width: 76px }
    .embeddedGrid #filename { min-width: 0; font-size: 12px }
    .embeddedGrid #open { flex-shrink: 0 }
    .embeddedGrid .searchGroup { order: -2; flex: 0 0 auto; width: auto; flex-wrap: nowrap }
    .embeddedGrid .searchGroup input { flex: 0 0 auto; width: 100px; min-width: 0; padding: 4px; font-size: 12px }
    .embeddedGrid #searchCount { flex: 0 0 auto; font-size: 11px; white-space: nowrap }
    .embeddedGrid #zoomLabel { width: 36px }
    @media (max-width: 760px) {
      .embeddedGrid .documentGroup { flex-basis: 95px }
      .embeddedGrid .searchGroup input { width: 88px }
    }
  `;
  view.head.append(style);
  addGridSteppers(view);
  const labelFilename = () => { filename.title = filename.textContent; };
  labelFilename();
  new MutationObserver(labelFilename).observe(filename, {childList:true, characterData:true, subtree:true});
}
const pdfTabs = [];
let activePdfTab;
let nextPdfTab = 0;
window.PDFGridReload.setup(() => activePdfTab, () => busy);

function activatePdfTab(tab, focus = false) {
  activePdfTab = tab;
  for (const item of pdfTabs) {
    const selected = item === tab;
    item.button.setAttribute('aria-selected', selected);
    item.button.tabIndex = selected ? 0 : -1;
    item.panel.setAttribute('aria-hidden', !selected);
    item.panel.inert = !selected;
  }
  if (focus) tab.button.focus();
  window.PDFGridSession.changed();
}

function createPdfTab() {
  const id = ++nextPdfTab;
  const tab = {
    frame: document.createElement('iframe'),
    panel: document.createElement('div'),
    item: document.createElement('div'),
    button: document.createElement('button'),
    close: document.createElement('button'),
    hasFile: false,
  };
  tab.frame.title = 'PDF Grid 격자 뷰어';
  tab.panel.className = 'pdfTabPanel';
  tab.panel.id = 'pdf-panel-' + id;
  tab.panel.setAttribute('role', 'tabpanel');
  tab.panel.setAttribute('aria-labelledby', 'pdf-tab-' + id);
  tab.item.className = 'pdfTab';
  tab.button.id = 'pdf-tab-' + id;
  tab.button.setAttribute('role', 'tab');
  tab.button.setAttribute('aria-controls', tab.panel.id);
  tab.button.onclick = () => activatePdfTab(tab, true);
  tab.close.textContent = '×';
  tab.close.onclick = () => {
    const index = pdfTabs.indexOf(tab);
    pdfTabs.splice(index, 1);
    $('pdfTabList').style.setProperty('--pdf-tab-count', pdfTabs.length);
    tab.item.remove();
    tab.panel.remove();
    if (activePdfTab === tab) activatePdfTab(pdfTabs[index] || pdfTabs[index - 1] || createPdfTab(), true);
    window.PDFGridSession.drop(tab);
  };
  function setName(name) {
    tab.button.textContent = tab.button.title = name;
    tab.close.setAttribute('aria-label', name + ' 닫기');
  }
  setName('새 탭');
  tab.ready = new Promise(resolve => {
    tab.frame.addEventListener('load', () => {
      compactGridViewer(tab.frame);
      const view = tab.frame.contentDocument;
      const filename = view.getElementById('filename');
      if (filename) {
        const syncName = () => {
          if (!view.getElementById('stage').classList.contains('ready')) return;
          tab.hasFile = true;
          setName(filename.textContent);
        };
        new MutationObserver(syncName).observe(filename, {childList: true, characterData: true, subtree: true});
        syncName();
      }
      resolve();
    }, {once: true});
  });
  tab.frame.src = GRID_VIEWER_URL + '&desktop=tab' + (!window.pdfGridDesktop && id === 1 ? '&restore=1' : '');
  tab.panel.append(tab.frame);
  tab.item.append(tab.button, tab.close);
  pdfTabs.push(tab);
  $('pdfTabList').style.setProperty('--pdf-tab-count', pdfTabs.length);
  $('pdfTabList').append(tab.item);
  $('pdfTabPanels').append(tab.panel);
  return tab;
}

$('pdfTabList').addEventListener('keydown', event => {
  if (event.target.getAttribute('role') !== 'tab') return;
  if (event.key === 'Delete') {
    event.preventDefault();
    activePdfTab.close.click();
    return;
  }
  const current = pdfTabs.indexOf(activePdfTab);
  const targets = {
    ArrowLeft: (current + pdfTabs.length - 1) % pdfTabs.length,
    ArrowRight: (current + 1) % pdfTabs.length,
    Home: 0,
    End: pdfTabs.length - 1,
  };
  if (!Object.hasOwn(targets, event.key)) return;
  event.preventDefault();
  activatePdfTab(pdfTabs[targets[event.key]], true);
});
window.pickPdfTabs = async () => {
  if (!window.pdfGridDesktop?.pickPDFs) { $('tabFiles').click(); return; }
  try {
    const files = await window.pdfGridDesktop.pickPDFs();
    await window.openPdfTabs(files.map(source => {
      const file = new File([source.bytes], source.name, {type:'application/pdf'});
      file.pdfGridSourceID = source.sourceID;
      return file;
    }));
  } catch (error) {
    activePdfTab?.frame.contentWindow.notice(error.message || 'PDF를 열지 못했습니다.');
  }
};
$('addPDFTab').onclick = () => void window.pickPdfTabs();
$('tabFiles').onchange = event => {
  void window.openPdfTabs([...event.target.files]);
  event.target.value = '';
};
window.openPdfTabs = async files => {
  await window.PDFGridSession.ready;
  const valid = [...files].filter(file => file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)));
  if (!valid.length) return;
  setTab('viewer');
  for (const file of valid) {
    const tab = activePdfTab?.hasFile ? createPdfTab() : activePdfTab || createPdfTab();
    tab.hasFile = true;
    activatePdfTab(tab);
    await tab.ready;
    if (pdfTabs.includes(tab) && await tab.frame.contentWindow.openFile(file)) { tab.file = file; await window.PDFGridSession.keep(tab,file); }
  }
};

function message(text, error = false) { $('feedback').textContent = text; $('feedback').classList.toggle('error', error); }
function clearResults() { outputURLs.forEach(url => URL.revokeObjectURL(url)); outputURLs = []; outputs = []; $('results').hidden = true; $('resultList').replaceChildren(); }
function setTab(name) {
  activeTab = name;
  $('reloadPDF').hidden = name !== 'viewer';
  document.querySelector('.documentTabs').hidden = name !== 'viewer';
  for (const tab of document.querySelectorAll('[data-tab]')) tab.setAttribute('aria-pressed', String(tab.dataset.tab === name));
  for (const id of ['merge', 'split', 'viewer', 'local']) $(id).hidden = id !== name;
  const readingOnly = name === 'viewer' || name === 'local';
  $('toolFooter').hidden = readingOnly; $('results').hidden = readingOnly || !outputs.length;
  $('feedback').hidden = readingOnly;
  window.scrollTo(0, 0);
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  if (name === 'viewer' && !activePdfTab) activatePdfTab(createPdfTab());
  $('viewer').style.top = document.querySelector('nav').getBoundingClientRect().bottom + 'px';
}
async function run(task) {
  if (busy) return;
  busy = true; $('workspace').inert = true; document.querySelector('nav').inert = true;
  try { await task(); } catch (error) { message(error.message || '처리하지 못했습니다. 다른 PDF를 선택해 주세요.', true); }
  finally { busy = false; $('workspace').inert = false; document.querySelector('nav').inert = false; refresh(); }
}
function humanSize(size) { return size > 1048576 ? (size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(size / 1024)) + ' KB'; }
async function readFile(file) {
  if (!file || !/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw new Error('PDF 파일을 선택해 주세요.');
  if (file.size > MAX_BYTES) throw new Error('한 번에 100 MB 이하의 PDF를 선택해 주세요.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let doc;
  try { doc = await core.loadPDF(bytes, lib); } catch (e) { throw new Error(`${file.name}: ${/암호|페이지/.test(e.message) ? e.message : 'PDF를 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해 주세요.'}`); }
  return {name: file.name, bytes, count: doc.getPageCount(), range: ''};
}
function refresh() {
  $('mergeCount').textContent = mergeFiles.length;
  $('mergeClear').disabled = !mergeFiles.length;
  try {
    const count = mergeFiles.reduce((sum, file) => sum + core.parsePages(file.range, file.count).length, 0);
    if (count > 20000) throw new Error('한 번에 최대 20,000쪽까지 합칠 수 있습니다.');
    $('mergeSummary').textContent = count ? `${mergeFiles.length}개 파일 → ${count}쪽 PDF 1개` : '파일을 추가해 주세요';
    $('mergeRun').disabled = !count;
  } catch (error) { $('mergeSummary').textContent = error.message; $('mergeRun').disabled = true; }
  $('splitOptions').disabled = !splitFile;
  const each = document.querySelector('[name=splitMode]:checked').value === 'each';
  $('splitRange').disabled = each || !splitFile;
  try {
    const groups = splitFile ? core.splitGroups($('splitRange').value, splitFile.count, each) : [];
    $('splitSummary').textContent = groups.length ? `${groups.reduce((sum, group) => sum + group.length, 0)}쪽 → PDF ${groups.length}개` : '파일을 선택해 주세요';
    $('splitRun').disabled = !groups.length;
  } catch (error) { $('splitSummary').textContent = error.message; $('splitRun').disabled = true; }
}
function button(text, label, action) { const el = document.createElement('button'); el.textContent = text; el.setAttribute('aria-label', label); el.title = label; el.onclick = action; return el; }
function renderMerge() {
  $('mergeList').replaceChildren();
  if (!mergeFiles.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '추가한 파일이 이곳에 표시됩니다.'; $('mergeList').append(empty); }
  mergeFiles.forEach((file, index) => {
    const row = document.createElement('div'); row.className = 'fileRow';
    const number = document.createElement('span'); number.className = 'order'; number.textContent = String(index + 1).padStart(2, '0');
    const meta = document.createElement('div'); meta.className = 'fileMeta';
    const title = document.createElement('strong'); title.textContent = file.name;
    const info = document.createElement('small'); info.textContent = `${file.count}쪽 · ${humanSize(file.bytes.length)}`; meta.append(title, info);
    const range = document.createElement('div'); range.className = 'fileRange';
    const label = document.createElement('label'); label.textContent = '포함할 쪽'; label.htmlFor = `range-${index}`;
    const input = document.createElement('input'); input.type = 'text'; input.id = label.htmlFor; input.placeholder = `전체 ${file.count}쪽`; input.value = file.range; input.setAttribute('aria-label', `${file.name} 포함할 쪽`);
    input.oninput = () => { mergeFiles = mergeFiles.map((item, n) => n === index ? {...item, range: input.value} : item); clearResults(); refresh(); }; range.append(label, input);
    const actions = document.createElement('div'); actions.className = 'rowActions';
    const up = button('↑', `${file.name} 위로`, () => move(index, -1)); up.disabled = index === 0;
    const down = button('↓', `${file.name} 아래로`, () => move(index, 1)); down.disabled = index === mergeFiles.length - 1;
    const remove = button('×', `${file.name} 제거`, () => { mergeFiles = mergeFiles.filter((_, n) => n !== index); clearResults(); renderMerge(); }); actions.append(up, down, remove);
    row.append(number, meta, range, actions); $('mergeList').append(row);
  });
  refresh();
}
function move(index, delta) { const next = [...mergeFiles]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; mergeFiles = next; clearResults(); renderMerge(); }
async function addMerge(files) {
  clearResults(); message('PDF를 확인하는 중…');
  if (mergeFiles.reduce((sum, f) => sum + f.bytes.length, 0) + files.reduce((sum, f) => sum + f.size, 0) > MAX_BYTES) throw new Error('합칠 파일의 총 용량은 100 MB 이하여야 합니다.');
  const added = [], errors = [];
  for (const file of files) { try { added.push(await readFile(file)); } catch (error) { errors.push(error.message); } }
  mergeFiles = [...mergeFiles, ...added]; renderMerge();
  message(errors.length ? errors.join(' / ') : `${added.length}개 파일을 추가했습니다. 순서와 쪽 범위를 확인해 주세요.`, !!errors.length);
}
async function chooseSplit(file) {
  message('PDF를 확인하는 중…'); const next = await readFile(file);
  splitFile = next; clearResults(); $('splitName').textContent = next.name; $('splitInfo').textContent = `${next.count}쪽 · ${humanSize(next.bytes.length)}`;
  $('splitChoose').textContent = '다른 PDF 선택'; $('splitRange').value = next.count > 1 ? `1; 2-${next.count}` : '1';
  message('쪽 범위를 입력하거나 한 쪽씩 분리하세요.'); refresh();
}
function safeBase(name) { return name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 100) || 'document'; }
function showResults(files) {
  clearResults(); outputs = files; $('results').hidden = false; $('resultTitle').textContent = `PDF ${files.length}개가 준비되었습니다.`; $('downloadAll').hidden = files.length < 2;
  for (const file of files) {
    const row = document.createElement('div'); row.className = 'resultRow';
    const title = document.createElement('span'); title.className = 'resultName'; title.textContent = `${file.name} · ${humanSize(file.bytes.length)}`;
    const link = document.createElement('a'); link.className = 'download'; link.textContent = 'PDF 받기 ↓'; link.download = file.name; link.href = URL.createObjectURL(new Blob([file.bytes], {type: 'application/pdf'})); outputURLs.push(link.href);
    link.onclick = event => {
      if (!window.pdfGridDesktop?.saveResult) return;
      event.preventDefault();
      if (!busy) run(async () => {
        if (await window.pdfGridDesktop.saveResult(file.name, file.bytes)) message('PDF 파일을 저장했습니다.');
      });
    };
    row.append(title, button('격자로 보기', `${file.name} 격자로 보기`, () => run(() => preview(file))), link); $('resultList').append(row);
  }
  message('완료했습니다. 파일을 받거나 격자 보기에서 결과를 확인하세요.'); $('results').scrollIntoView({behavior: 'smooth', block: 'nearest'});
}
async function preview(file) {
  const source = new File([file.bytes], file.name, {type: 'application/pdf'});
  source.pdfGridSourceID = file.sourceID;
  await window.openPdfTabs([source]);
}
async function sample(name, count, color) {
  const doc = await lib.PDFDocument.create();
  for (let n = 1; n <= count; n++) {
    const page = doc.addPage([595, 842]);
    page.drawRectangle({x: 0, y: 640, width: 595, height: 202, color: lib.rgb(...color)});
    page.drawText('PDF GRID / DEMO', {x: 45, y: 780, size: 14, color: lib.rgb(1, 1, 1)});
    page.drawText(`${name} / ${n}`, {x: 45, y: 700, size: 34, color: lib.rgb(1, 1, 1)});
    page.drawText(`Original page ${n} of ${count}`, {x: 45, y: 580, size: 22});
    page.drawText('Try merging, reordering, or splitting these pages.', {x: 45, y: 535, size: 14});
    page.drawText(String(n).padStart(2, '0'), {x: 45, y: 90, size: 100, color: lib.rgb(...color)});
  }
  return new File([await doc.save()], `${name}.pdf`, {type: 'application/pdf'});
}
for (const tab of document.querySelectorAll('[data-tab]')) tab.onclick = () => { if (!busy) setTab(tab.dataset.tab); };
$('mergeChoose').onclick = () => $('mergeFiles').click(); $('splitChoose').onclick = () => $('splitFile').click();
$('mergeFiles').onchange = event => { const files = [...event.target.files]; event.target.value = ''; if (files.length) run(() => addMerge(files)); };
$('splitFile').onchange = event => { const file = event.target.files[0]; event.target.value = ''; if (file) run(() => chooseSplit(file)); };
$('mergeClear').onclick = () => { mergeFiles = []; clearResults(); message(''); renderMerge(); };
$('splitRange').oninput = () => { clearResults(); refresh(); };
for (const radio of document.querySelectorAll('[name=splitMode]')) radio.onchange = () => { clearResults(); refresh(); };
$('mergeRun').onclick = () => run(async () => { clearResults(); message('PDF를 합치는 중…'); const bytes = await core.combine(mergeFiles, lib); showResults([{name: 'merged.pdf', bytes}]); });
$('splitRun').onclick = () => run(async () => {
  const groups = core.splitGroups($('splitRange').value, splitFile.count, document.querySelector('[name=splitMode]:checked').value === 'each');
  clearResults(); const files = [], base = safeBase(splitFile.name);
  for (let i = 0; i < groups.length; i++) { message(`PDF를 분리하는 중… ${i + 1} / ${groups.length}`); await new Promise(resolve => setTimeout(resolve, 0)); files.push({name: `${base}_part-${String(i + 1).padStart(3, '0')}.pdf`, bytes: await core.extract(splitFile.bytes, groups[i], lib)}); }
  showResults(files);
});
$('downloadAll').onclick = () => run(async () => {
  message('ZIP 파일을 준비하는 중…'); const zip = new JSZip(); outputs.forEach(file => zip.file(file.name, file.bytes));
  const bytes = await zip.generateAsync({type: 'uint8array'});
  if (window.pdfGridDesktop?.saveResult) {
    if (await window.pdfGridDesktop.saveResult('pdf-grid-split.zip', bytes)) message('ZIP 파일을 저장했습니다.');
  } else {
    const url = URL.createObjectURL(new Blob([bytes], {type: 'application/zip'}));
    const link = document.createElement('a'); link.href = url; link.download = 'pdf-grid-split.zip';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    message('ZIP 파일을 다운로드했습니다.');
  }
});
$('mergeDemo').onclick = () => run(async () => { const a = await sample('Sample-A', 3, [.25, .4, .24]), b = await sample('Sample-B', 2, [.2, .32, .48]); await addMerge([a, b]); });
$('splitDemo').onclick = () => run(async () => chooseSplit(await sample('Sample-5-pages', 5, [.25, .4, .24])));
for (const [id, target] of [['mergeDrop', 'merge'], ['splitDrop', 'split']]) {
  const zone = $(id);
  zone.ondragover = event => { event.preventDefault(); zone.classList.add('over'); }; zone.ondragleave = () => zone.classList.remove('over');
  zone.ondrop = event => { event.preventDefault(); zone.classList.remove('over'); const files = [...event.dataTransfer.files]; if (busy || !files.length) return; run(async () => { if (target === 'split' && files.length !== 1) throw new Error('분리할 PDF는 하나만 선택해 주세요.'); await (target === 'merge' ? addMerge(files) : chooseSplit(files[0])); }); };
}
window.addEventListener('dragover', event => event.preventDefault()); window.addEventListener('drop', event => event.preventDefault());
window.addEventListener('resize', () => { $('viewer').style.top = document.querySelector('nav').getBoundingClientRect().bottom + 'px'; });
new ResizeObserver(() => { $('viewer').style.top = document.querySelector('nav').getBoundingClientRect().bottom + 'px'; }).observe(document.querySelector('nav'));
if (!lib || !core || !window.JSZip) { message('PDF 도구를 불러오지 못했습니다. 페이지를 새로고침해 주세요.', true); document.querySelectorAll('button').forEach(el => el.disabled = true); } else refresh();

window.addEventListener('hashchange', () => { if (!busy && ['merge', 'split', 'viewer', 'local'].includes(location.hash.slice(1))) setTab(location.hash.slice(1)); });
setTab(['merge', 'split', 'viewer', 'local'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'viewer');

window.PDFGridNavigation={move:direction=>activePdfTab?.frame.contentWindow.pdfGridHistoryMove?.(direction)};
const editingTarget=target=>target?.closest?.('input,textarea,select,[contenteditable]');
document.addEventListener('keydown',event=>{const hardware=event.key==='BrowserBack'||event.key==='BrowserForward';if(event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||(!hardware&&editingTarget(event.target)))return;const direction=(event.key==='['||event.key==='BrowserBack')?-1:(event.key===']'||event.key==='BrowserForward')?1:0;if(direction){event.preventDefault();window.PDFGridNavigation.move(direction)}},true);
for(const type of ['mousedown','mouseup','auxclick'])document.addEventListener(type,event=>{if(event.button!==3&&event.button!==4)return;event.preventDefault();if(type==='mousedown')window.PDFGridNavigation.move(event.button===3?-1:1)},true);
window.PDFGridSession.start({tabs:()=>pdfTabs,active:()=>activePdfTab,activate:activatePdfTab,restore:async(file,state,id)=>{
 const tab=activePdfTab?.hasFile?createPdfTab():activePdfTab||createPdfTab();tab.sessionID=id;tab.hasFile=true;activatePdfTab(tab);await tab.ready;
 if(await tab.frame.contentWindow.openFile(file,state)){tab.file=file;return tab}tab.hasFile=false;return null;
}});
if (window.pdfGridDesktop) {
  let reading = false;
  let requested = false;
  async function openPendingPDFs() {
    requested = true;
    if (reading) return;
    reading = true;
    try {
      await window.PDFGridSession.ready;
      do {
        requested = false;
        let file;
        while ((file = await window.pdfGridDesktop.getStartupPDF())) await preview(file);
      } while (requested);
    } catch (error) {
      message(error.message, true);
    } finally {
      reading = false;
    }
  }
  window.pdfGridDesktop.onPDFOpenRequested(openPendingPDFs);
  void openPendingPDFs();
}
