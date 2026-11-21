'use strict';
const $ = id => document.getElementById(id);
const lib = window.PDFLib, core = window.PDFGridTools;
let mergeFiles = [], splitFile = null, outputs = [], outputURLs = [], activeTab = 'merge', busy = false;
const MAX_BYTES = 100 * 1024 * 1024;
const macDesktop = window.pdfGridDesktop?.platform === 'darwin';
const tabShortcutLabel = macDesktop ? '⌘' : 'Ctrl+';
const GRID_VIEWER_URL = window.pdfGridDesktop ? '../?v=1.6.4' : '../viewer/?v=1.6.4';
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
  bindTabShortcuts(view);
  window.PDFGridTabMenu.bind(view);
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
const closedPdfTabs = [];
let reopeningPdf = false, splitPdfTabs = null, splitRatio = 50, layoutGeneration = 0, pendingPdfLayout = Promise.resolve();
let pdfTabDrag, suppressPdfTabClick;
const splitDivider = document.createElement('div');
splitDivider.id = 'pdfSplitDivider'; splitDivider.hidden = true; splitDivider.tabIndex = 0;
splitDivider.setAttribute('role','separator'); splitDivider.setAttribute('aria-label','두 PDF 사이 폭 조절'); splitDivider.setAttribute('aria-orientation','vertical');
splitDivider.setAttribute('aria-valuemin','25'); splitDivider.setAttribute('aria-valuemax','75');
$('pdfTabPanels').append(splitDivider);
window.PDFGridReload.setup(() => activePdfTab, () => busy);
function bindTabShortcuts(view) {
  // Chrome reserves Ctrl+W for the browser tab; only the installed host owns it.
  if (!window.pdfGridDesktop) return;
  view.addEventListener('keydown', event => {
    const modifier = event.metaKey ? macDesktop && !event.ctrlKey : event.ctrlKey;
    if (!modifier || event.altKey || event.isComposing) return;
    const reopen = event.shiftKey && (event.code === 'KeyT' || event.key.toLowerCase() === 't');
    if (reopen) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) void reopenClosedPdfTab();
      return;
    }
    if ((event.code !== 'KeyW' && event.key.toLowerCase() !== 'w') || event.shiftKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat && activeTab === 'viewer' && !document.querySelector('#updateDialog[open]')) closePdfTab(activePdfTab);
  }, true);
}
bindTabShortcuts(document);

function pdfFile(tab) { return tab?.file || tab?.frame.contentWindow?.gridReloadFile?.(); }
function hasPdfDocument(tab) { return !!(tab?.saved || pdfFile(tab)); }
function readablePdfTabs() { return pdfTabs.filter(hasPdfDocument); }
function showPdfTab(tab) {
  return tab ? window.PDFGridSession.load(tab) : Promise.resolve();
}
function workspaceControls() {
  $('reopenPDFTab').disabled = reopeningPdf || !closedPdfTabs.length;
  if(reopeningPdf)$('reopenPDFTab').setAttribute('aria-busy','true');else $('reopenPDFTab').removeAttribute('aria-busy');
  $('reopenPDFTab').title = '닫은 탭 복원' + (window.pdfGridDesktop ? ' (' + tabShortcutLabel + 'Shift+T)' : '');
  $('toggleSplitView').disabled = !splitPdfTabs && readablePdfTabs().length < 2;
  $('toggleSplitView').setAttribute('aria-pressed', String(!!splitPdfTabs));
  $('toggleSplitView').textContent = splitPdfTabs ? '나란히 끄기' : '나란히 보기';
}
function canDragPdfTab(tab) {
  return hasPdfDocument(tab) && (!!splitPdfTabs || tab !== activePdfTab && hasPdfDocument(activePdfTab));
}
function renderPdfTabs() {
  if (pdfTabDrag && (pdfTabDrag.layout !== splitPdfTabs || pdfTabDrag.tab.removed ||
      (!splitPdfTabs && pdfTabDrag.previousActive !== activePdfTab))) finishPdfTabDrag();
  for (const item of pdfTabs) {
    const selected = item === activePdfTab, pane = splitPdfTabs?.indexOf(item) ?? -1;
    const visible = splitPdfTabs ? pane >= 0 : selected;
    item.button.setAttribute('aria-selected', selected);
    item.button.tabIndex = selected ? 0 : -1;
    item.button.toggleAttribute('data-pane-draggable', canDragPdfTab(item));
    item.panel.setAttribute('aria-hidden', !visible);
    item.panel.dataset.active = String(selected);
    item.panel.classList.toggle('splitLeft', pane === 0); item.panel.classList.toggle('splitRight', pane === 1);
    item.paneName.textContent = (pane === 0 ? '왼쪽 · ' : '오른쪽 · ') + (item.name || '새 탭');
    item.panel.inert = !visible;
  }
  $('pdfTabPanels').classList.toggle('splitView', !!splitPdfTabs);
  $('pdfTabPanels').style.gridTemplateColumns = splitPdfTabs ? `${splitRatio}fr 7px ${100-splitRatio}fr` : '';
  splitDivider.hidden = !splitPdfTabs; splitDivider.setAttribute('aria-valuenow',String(Math.round(splitRatio)));
  workspaceControls();
}
function capturePdfViews() {
  return new Map(pdfTabs.filter(tab => !tab.saved && pdfFile(tab)).map(tab => [tab,tab.frame.contentWindow.gridReloadState().view]));
}
function relayoutPdfPanels(change, views = capturePdfViews()) {
  const generation = ++layoutGeneration;
  change(); renderPdfTabs();
  pendingPdfLayout = (async()=>{
    await new Promise(resolve => {const timer=setTimeout(resolve,120);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timer);resolve()}))});
    if (generation !== layoutGeneration) return;
    for (const tab of pdfTabs) if (views.has(tab)) tab.frame.contentWindow.gridResizeView(views.get(tab));
    window.PDFGridSession.changed();
  })();
  return pendingPdfLayout;
}
function activatePdfTab(tab, focus = false, destination = null) {
  if (!pdfTabs.includes(tab)) return;
  const currentPane = splitPdfTabs?.indexOf(tab);
  const nextPane = destination ?? (currentPane === -1 ? splitPdfTabs.indexOf(activePdfTab) : currentPane);
  if (splitPdfTabs && nextPane >= 0 && nextPane !== currentPane) {
    void relayoutPdfPanels(() => {
      if (currentPane >= 0) splitPdfTabs[currentPane] = splitPdfTabs[nextPane];
      splitPdfTabs[nextPane] = tab;
      activePdfTab = tab;
    });
  } else { activePdfTab = tab; renderPdfTabs(); }
  if (focus) tab.button.focus();
  window.PDFGridSession.changed();
  return showPdfTab(tab);
}
function canSplitPdf(tab) { return hasPdfDocument(tab) && readablePdfTabs().length >= 2; }
async function openSplitPdf(tab = activePdfTab) {
  if (busy || readablePdfTabs().length < 2) return;
  if (!canSplitPdf(tab)) tab = readablePdfTabs()[0];
  const left = hasPdfDocument(activePdfTab) ? activePdfTab : readablePdfTabs()[0];
  const right = tab !== left ? tab : readablePdfTabs().find(other => other !== left);
  await showSplitPdfTabs(left, right, left);
}
async function showSplitPdfTabs(left, right, active) {
  await relayoutPdfPanels(() => { splitPdfTabs = [left,right]; activePdfTab = active; });
  await Promise.all([showPdfTab(left), showPdfTab(right)]);
}
async function closeSplitPdf() {
  if (splitPdfTabs) await relayoutPdfPanels(() => { splitPdfTabs = null; });
}
function closePdfTab(tab, remember = true) {
  if (!pdfTabs.includes(tab)) return;
  window.PDFGridTabMenu.close();
  const previousActive = activePdfTab;
  const existingRecord = closedPdfTabs.includes(tab.reopenRecord) ? tab.reopenRecord : null;
  const preserveSnapshot = remember && !!(tab.saved || existingRecord?.saved);
  const openedFile = pdfFile(tab);
  const file = openedFile || tab.pendingFile;
  if (remember && !existingRecord && (tab.saved || file)) {
    const index = pdfTabs.indexOf(tab);
    closedPdfTabs.push(tab.saved ? {saved:tab.saved,index} :
      {file,state:openedFile ? tab.refreshState || tab.frame.contentWindow.gridReloadState() : null,index,width:tab.frame.clientWidth});
    if (closedPdfTabs.length > 20) {
      const evicted = closedPdfTabs.shift();
      if (!pdfTabs.some(item => item.reopenRecord === evicted)) window.PDFGridSession.drop(evicted.saved?.id);
    }
  }
  const views = capturePdfViews(), resizing = !!splitPdfTabs?.includes(tab);
  const remove = () => {
    const index = pdfTabs.indexOf(tab), remaining = splitPdfTabs?.find(other => other !== tab);
    tab.removed = true;
    tab.resolveClosed(false);
    pdfTabs.splice(index,1); tab.item.remove(); tab.panel.remove(); tab.resolveMount?.();
    $('pdfTabList').style.setProperty('--pdf-tab-count',pdfTabs.length);
    if (resizing) splitPdfTabs = null;
    if (activePdfTab === tab) activePdfTab = resizing ? remaining : pdfTabs[index] || pdfTabs[index-1] || createPdfTab();
    if (!preserveSnapshot) window.PDFGridSession.drop(tab.sessionID);
  };
  if (resizing) void relayoutPdfPanels(remove, views); else { remove(); renderPdfTabs(); }
  if (activePdfTab !== previousActive) void showPdfTab(activePdfTab);
  activePdfTab?.button.focus(); window.PDFGridSession.changed();
}
async function reopenClosedPdfTab() {
  if (reopeningPdf || !closedPdfTabs.length || busy || document.querySelector('#updateDialog[open]')) return;
  window.PDFGridTabMenu.close();
  reopeningPdf = true; workspaceControls();
  const record = closedPdfTabs[closedPdfTabs.length-1];
  let tab;
  try {
    setTab('viewer');
    tab = record.saved ? createPdfTab(record.saved) :
      activePdfTab?.hasFile ? createPdfTab() : activePdfTab || createPdfTab();
    tab.reopenRecord = record;
    tab.restoring = true;
    tab.hasFile = true;
    tab.reload.disabled = true;
    tab.reload.setAttribute('aria-busy','true');
    tab.setName(record.saved?.name || record.file.name);
    if (record.saved && activePdfTab && !activePdfTab.hasFile && !splitPdfTabs) {
      closePdfTab(activePdfTab, false);
    }
    const previous = pdfTabs.indexOf(tab); pdfTabs.splice(previous,1); pdfTabs.splice(Math.min(record.index,pdfTabs.length),0,tab);
    for (const item of pdfTabs) $('pdfTabList').append(item.item);
    await Promise.race([restoreClosedPdf(tab, record), tab.closed]);
    if (tab.removed) return;
    const closedIndex = closedPdfTabs.indexOf(record);
    if (closedIndex >= 0) closedPdfTabs.splice(closedIndex, 1);
    renderPdfTabs();
  } catch (error) {
    if (tab?.removed) return;
    if (tab) closePdfTab(tab, false);
    activePdfTab?.frame.contentWindow?.notice?.(error.message || '닫은 탭을 복원하지 못했습니다.');
  } finally {
    if (tab && !tab.removed) {
      tab.restoring = false;
      tab.reopenRecord = null;
      tab.reload.disabled = !tab.hasFile;
      tab.reload.removeAttribute('aria-busy');
    }
    reopeningPdf = false;
    workspaceControls();
  }
}
async function restoreClosedPdf(tab, record) {
  await activatePdfTab(tab);
  if (tab.removed || record.saved) return;
  let file = record.file, fallback = false;
  try {
    if (file.pdfGridSourceID && window.pdfGridDesktop) {
      const source = await pdfGridDesktop.refreshPDF(file.pdfGridSourceID);
      file = new File([source.bytes],source.name,{type:'application/pdf'});
      file.pdfGridSourceID = source.sourceID;
    } else if (file.pdfGridHandle) {
      const handle = file.pdfGridHandle;
      file = await handle.getFile();
      file.pdfGridHandle = handle;
    }
  } catch { fallback = true; }
  if (tab.removed) return;
  const viewer = tab.frame.contentWindow;
  let opened = await viewer.openFile(file, record.state, false);
  if (tab.removed) return;
  if (!opened && file !== record.file) {
    fallback = true;
    file = record.file;
    opened = await viewer.openFile(file, record.state, false);
  }
  if (tab.removed) return;
  if (!opened) throw Error('PDF를 다시 열지 못했습니다.');
  tab.file = file;
  await pendingPdfLayout;
  if (tab.removed) return;
  if (record.state?.view) {
    if (tab.frame.clientWidth !== record.width) viewer.gridResizeView(record.state.view);
    else viewer.gridRestoreView(record.state.view);
  }
  await window.PDFGridSession.keep(tab,file);
  if (tab.removed) return;
  if (tab === activePdfTab) viewer.document.getElementById('stage').focus({preventScroll:true});
  if (fallback) viewer.notice('원본을 읽지 못해 닫을 때의 PDF를 복원했습니다.');
}
window.PDFGridTabs = {reopen:reopenClosedPdfTab,canReopen:()=>!!closedPdfTabs.length&&!reopeningPdf,split:openSplitPdf,canSplit:canSplitPdf,closeSplit:closeSplitPdf};
$('reopenPDFTab').onclick = () => void reopenClosedPdfTab();
$('toggleSplitView').onclick = () => void (splitPdfTabs ? closeSplitPdf() : openSplitPdf());
let splitDrag = null;
splitDivider.addEventListener('pointerdown',event=>{
  if (event.button !== 0 || !splitPdfTabs) return;
  event.preventDefault(); splitDrag = {id:event.pointerId,views:capturePdfViews()}; splitDivider.setPointerCapture(event.pointerId);
});
splitDivider.addEventListener('pointermove',event=>{
  if (splitDrag?.id !== event.pointerId) return;
  const rect=$('pdfTabPanels').getBoundingClientRect(), ratio=Math.max(25,Math.min(75,(event.clientX-rect.left)/rect.width*100));
  void relayoutPdfPanels(()=>{splitRatio=ratio},splitDrag.views);
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])splitDivider.addEventListener(type,event=>{if(splitDrag?.id===event.pointerId){splitDrag=null;if(splitDivider.hasPointerCapture(event.pointerId))splitDivider.releasePointerCapture(event.pointerId)}});
splitDivider.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();void relayoutPdfPanels(()=>{splitRatio=Math.max(25,Math.min(75,splitRatio+(event.key==='ArrowLeft'?-5:5)))});}});

function pdfPaneAt(event) {
  const containsPointer = rect => event.clientX >= rect.left && event.clientX < rect.right &&
    event.clientY >= rect.top && event.clientY < rect.bottom;
  if (splitPdfTabs) return splitPdfTabs.findIndex(tab => containsPointer(tab.panel.getBoundingClientRect()));
  const area = $('pdfTabPanels').getBoundingClientRect();
  if (!containsPointer(area)) return -1;
  return event.clientX < area.left + area.width / 2 ? 0 : 1;
}
function finishPdfTabDrag(event) {
  const drag = pdfTabDrag;
  if (!drag) return;
  const destination = event && drag.moved && drag.layout === splitPdfTabs ? pdfPaneAt(event) : -1;
  pdfTabDrag = null;
  drag.tab.item.classList.remove('tabDragSource');
  drag.target?.classList.remove('tabDropTarget');
  $('pdfTabPanels').classList.remove('tabDragActive');
  delete $('pdfTabPanels').dataset.tabDropSide;
  if (drag.tab.button.hasPointerCapture(drag.pointerId)) drag.tab.button.releasePointerCapture(drag.pointerId);
  if (destination < 0 || !canDragPdfTab(drag.tab)) return;
  if (splitPdfTabs) {
    void activatePdfTab(drag.tab, true, destination);
  } else {
    const current = activePdfTab;
    const [left, right] = destination === 0 ? [drag.tab, current] : [current, drag.tab];
    void showSplitPdfTabs(left, right, drag.tab);
    drag.tab.button.focus({preventScroll:true});
  }
}
function bindPdfTabDrag(tab) {
  const button = tab.button;
  button.addEventListener('pointerdown', event => {
    suppressPdfTabClick = null;
    if (pdfTabDrag || busy || event.button !== 0 || event.pointerType === 'touch' || !canDragPdfTab(tab)) return;
    pdfTabDrag = {
      tab, layout:splitPdfTabs, previousActive:activePdfTab,
      pointerId:event.pointerId, x:event.clientX, y:event.clientY,
    };
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    const drag = pdfTabDrag;
    if (drag?.tab !== tab || drag.pointerId !== event.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
      drag.moved = true;
      suppressPdfTabClick = tab;
      tab.item.classList.add('tabDragSource');
      $('pdfTabPanels').classList.add('tabDragActive');
    }
    const destination = pdfPaneAt(event);
    if (!splitPdfTabs) {
      if (destination < 0) delete $('pdfTabPanels').dataset.tabDropSide;
      else $('pdfTabPanels').dataset.tabDropSide = destination === 0 ? 'left' : 'right';
      return;
    }
    const target = splitPdfTabs[destination]?.panel;
    if (target === drag.target) return;
    drag.target?.classList.remove('tabDropTarget');
    target?.classList.add('tabDropTarget');
    drag.target = target;
  });
  button.addEventListener('pointerup', event => {
    if (pdfTabDrag?.pointerId === event.pointerId) finishPdfTabDrag(event);
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, event => {
      if (pdfTabDrag?.pointerId === event.pointerId) finishPdfTabDrag();
    });
  }
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && pdfTabDrag?.moved) {
    event.preventDefault();
    finishPdfTabDrag();
  }
}, true);
window.addEventListener('blur', () => finishPdfTabDrag());

function createPdfTab(saved = null) {
  const id = ++nextPdfTab;
  const tab = {
    frame: document.createElement('iframe'),
    panel: document.createElement('div'),
    item: document.createElement('div'),
    button: document.createElement('button'),
    reload: document.createElement('button'),
    close: document.createElement('button'),
    paneName: document.createElement('div'),
    saved,
    sessionID: saved?.id,
    hasFile: !!saved,
  };
  // A removed iframe can stop running pending PDF.js callbacks.
  tab.closed = new Promise(resolve => { tab.resolveClosed = resolve; });
  tab.frame.title = 'PDF Grid 격자 뷰어';
  tab.panel.className = 'pdfTabPanel';
  tab.panel.id = 'pdf-panel-' + id;
  tab.panel.setAttribute('role', 'tabpanel');
  tab.panel.setAttribute('aria-labelledby', 'pdf-tab-' + id);
  tab.panel.setAttribute('aria-hidden','true'); tab.panel.dataset.active='false'; tab.panel.inert=true;
  tab.paneName.className='pdfPaneHeading'; tab.paneName.onclick=()=>activatePdfTab(tab);
  tab.paneName.ondrop = event => void tab.frame.contentWindow?.dropPdfFiles?.(event);
  tab.item.className = 'pdfTab';
  tab.button.id = 'pdf-tab-' + id;
  tab.button.setAttribute('role', 'tab');
  tab.button.setAttribute('aria-controls', tab.panel.id);
  tab.button.onclick = event => {
    if (event.detail && suppressPdfTabClick === tab) {
      suppressPdfTabClick = null;
      return;
    }
    void activatePdfTab(tab, true);
  };
  bindPdfTabDrag(tab);
  window.PDFGridTabMenu.attach(tab);
  tab.reload.type = 'button';
  tab.reload.className = 'pdfTabReload';
  tab.reload.disabled = true;
  tab.reload.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M13 6a5.3 5.3 0 1 0 .1 3M13 2v4H9"/></svg>';
  tab.reload.onclick = () => void window.PDFGridReload.refresh(tab);
  tab.close.textContent = '×';
  tab.close.onclick = () => closePdfTab(tab);
  function setName(name) {
    tab.name=name;
    tab.button.textContent = tab.button.title = name;
    tab.close.setAttribute('aria-label', name + ' 닫기');
    tab.close.title = name + ' 닫기' + (window.pdfGridDesktop ? ' (' + tabShortcutLabel + 'W)' : '');
    tab.reload.setAttribute('aria-label', name + ' 새로고침');
    tab.reload.title = name + ' 새로고침';
  }
  setName(saved?.name || '새 탭');
  tab.setName = setName;
  tab.reload.disabled = !saved;
  let mounted;
  tab.mount = () => mounted ??= new Promise(resolve => {
    tab.resolveMount = resolve;
    tab.frame.addEventListener('load', () => {
      if (tab.removed) return;
      const paneFocus = () => { if (splitPdfTabs?.includes(tab) && activePdfTab !== tab) activatePdfTab(tab); };
      tab.frame.contentDocument.addEventListener('pointerdown',paneFocus,true);
      tab.frame.contentDocument.addEventListener('keydown',paneFocus,true);
      compactGridViewer(tab.frame);
      const view = tab.frame.contentDocument;
      const filename = view.getElementById('filename');
      if (filename) {
        const syncName = () => {
          if (tab.removed || !view.getElementById('stage').classList.contains('ready')) return;
          tab.hasFile = true;
          tab.reload.disabled = tab.reload.getAttribute('aria-busy') === 'true';
          setName(filename.textContent);
          renderPdfTabs();
        };
        new MutationObserver(syncName).observe(filename, {childList: true, characterData: true, subtree: true});
        syncName();
      }
      tab.resolveMount = null;
      resolve();
    }, {once: true});
    tab.frame.src = GRID_VIEWER_URL + '&desktop=tab' + (!window.pdfGridDesktop && id === 1 ? '&restore=1' : '');
    tab.panel.append(tab.frame);
  });
  tab.panel.append(tab.paneName);
  tab.item.append(tab.reload, tab.button, tab.close);
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
    activePdfTab?.frame.contentWindow?.notice?.(error.message || 'PDF를 열지 못했습니다.');
  }
};
$('addPDFTab').onclick = () => void window.pickPdfTabs();
$('tabFiles').onchange = event => {
  void window.openPdfTabs([...event.target.files]);
  event.target.value = '';
};
async function openPdfFiles(files, destination = null) {
  const valid = [...files].filter(file => file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)));
  if (!valid.length) return;
  setTab('viewer');
  for (const file of valid) {
    const tab = !destination && activePdfTab && !activePdfTab.hasFile ? activePdfTab : createPdfTab();
    tab.hasFile = true;
    tab.pendingFile = file;
    tab.setName(file.name);
    await Promise.race([openPdfInTab(tab, file, destination), tab.closed]);
  }
}
async function openPdfInTab(tab, file, destination) {
  try {
    await (destination ? tab.mount() : activatePdfTab(tab));
    if (tab.removed) return;
    if (!file.pdfGridSourceID && window.pdfGridDesktop?.sourceForFile) {
      // Some Files are generated in memory and have no native path.
      try { file.pdfGridSourceID = await window.pdfGridDesktop.sourceForFile(file); } catch {}
    }
    if (tab.removed) return;
    const viewer = tab.frame.contentWindow;
    const opened = await viewer.openFile(file, null, false);
    if (tab.removed) return;
    tab.hasFile = !!opened;
    if (!opened) {
      if (destination) {
        const pane = destination.layout === splitPdfTabs ? splitPdfTabs[destination.index] : activePdfTab;
        pane?.frame.contentWindow?.notice?.(viewer.document.getElementById('toast').textContent || 'PDF를 열지 못했습니다.');
        closePdfTab(tab, false);
      } else {
        tab.setName('새 탭');
      }
      return;
    }
    tab.file = file;
    if (destination && destination.layout === splitPdfTabs) {
      await relayoutPdfPanels(() => {
        splitPdfTabs[destination.index] = tab;
        activePdfTab = tab;
      });
    }
    if (tab === activePdfTab) viewer.document.getElementById('stage').focus({preventScroll:true});
    await window.PDFGridSession.keep(tab,file);
  } finally {
    tab.pendingFile = null;
  }
}
window.openPdfTabs = async (files, dropFrame) => {
  const index = splitPdfTabs?.findIndex(tab => tab.frame.contentWindow === dropFrame) ?? -1;
  const destination = index >= 0 ? {layout: splitPdfTabs, index} : null;
  await window.PDFGridSession.ready;
  await openPdfFiles(files, destination);
};

function message(text, error = false) { $('feedback').textContent = text; $('feedback').classList.toggle('error', error); }
function clearResults() { outputURLs.forEach(url => URL.revokeObjectURL(url)); outputURLs = []; outputs = []; $('results').hidden = true; $('resultList').replaceChildren(); }
function setTab(name) {
  if (name !== 'viewer') finishPdfTabDrag();
  activeTab = name;
  document.querySelector('.documentTabs').hidden = name !== 'viewer';
  for (const tab of document.querySelectorAll('[data-tab]')) tab.setAttribute('aria-pressed', String(tab.dataset.tab === name));
  for (const id of ['merge', 'split', 'viewer', 'local']) $(id).hidden = id !== name;
  const readingOnly = name === 'viewer' || name === 'local';
  $('toolFooter').hidden = readingOnly; $('results').hidden = readingOnly || !outputs.length;
  $('feedback').hidden = readingOnly;
  window.scrollTo(0, 0);
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  if (name === 'viewer' && !activePdfTab && !startingNative) activatePdfTab(createPdfTab());
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
async function preview(file, open = window.openPdfTabs) {
  const source = new File([file.bytes], file.name, {type: 'application/pdf'});
  source.pdfGridSourceID = file.sourceID;
  await open([source]);
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

let startingNative = !!window.pdfGridDesktop;
window.addEventListener('hashchange', () => { if (!busy && ['merge', 'split', 'viewer', 'local'].includes(location.hash.slice(1))) setTab(location.hash.slice(1)); });
setTab(['merge', 'split', 'viewer', 'local'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'viewer');

window.PDFGridNavigation={move:direction=>activePdfTab?.frame.contentWindow?.pdfGridHistoryMove?.(direction)};
const editingTarget=target=>target?.closest?.('input,textarea,select,[contenteditable]');
document.addEventListener('keydown',event=>{const hardware=event.key==='BrowserBack'||event.key==='BrowserForward';if(event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||(!hardware&&editingTarget(event.target)))return;const direction=(event.key==='['||event.key==='BrowserBack')?-1:(event.key===']'||event.key==='BrowserForward')?1:0;if(direction){event.preventDefault();window.PDFGridNavigation.move(direction)}},true);
for(const type of ['mousedown','mouseup','auxclick'])document.addEventListener(type,event=>{if(event.button!==3&&event.button!==4)return;event.preventDefault();if(type==='mousedown')window.PDFGridNavigation.move(event.button===3?-1:1)},true);
const session = window.PDFGridSession;
const savedWorkspace = session.start({
  tabs: () => pdfTabs,
  active: () => activePdfTab,
  add: createPdfTab,
  closedIds: () => closedPdfTabs.map(record => record.saved?.id),
  settle: () => pendingPdfLayout,
  layout: () => splitPdfTabs ? {left:splitPdfTabs[0].sessionID,right:splitPdfTabs[1].sessionID,ratio:splitRatio} : null,
});
if (startingNative) {
  renderPdfTabs();
  let reading;
  let requested = false;
  function openPendingPDFs() {
    requested = true;
    return reading ??= (async () => {
      do {
        requested = false;
        let file;
        while ((file = await window.pdfGridDesktop.getStartupPDF())) {
          startingNative = false;
          await preview(file, openPdfFiles);
        }
      } while (requested);
    })().catch(error => {
      message(error.message, true);
    }).finally(() => { reading = null; });
  }
  window.pdfGridDesktop.onPDFOpenRequested(openPendingPDFs);
  session.ready = (async () => {
    // The native queue wins on cold launch. Old tabs stay metadata-only, even
    // when a split layout was saved. An ordinary launch restores visible panes.
    await openPendingPDFs();
    const restoreWorkspace = startingNative;
    startingNative = false;
    if (restoreWorkspace && !activePdfTab) {
      const layout = savedWorkspace?.layout;
      const savedTab = id => pdfTabs.find(tab => tab.sessionID === id);
      const active = savedTab(savedWorkspace?.active) || pdfTabs[0];
      const left = layout && savedTab(layout.left), right = layout && savedTab(layout.right);
      if (left && right && left !== right) {
        splitRatio = Math.max(25, Math.min(75, Number(layout.ratio) || 50));
        splitPdfTabs = [left,right];
        activePdfTab = splitPdfTabs.includes(active) ? active : left;
        renderPdfTabs();
        await Promise.all([showPdfTab(left), showPdfTab(right)]);
      } else {
        await activatePdfTab(active || createPdfTab());
      }
    }
  })().finally(() => session.finishStartup());
} else {
  session.finishStartup();
}
