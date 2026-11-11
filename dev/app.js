'use strict';
const $ = id => document.getElementById(id);
const lib = window.PDFLib, core = window.PDFGridTools;
let mergeFiles = [], splitFile = null, outputs = [], outputURLs = [], activeTab = 'merge', busy = false;
const MAX_BYTES = 100 * 1024 * 1024;
function message(text, error = false) { $('feedback').textContent = text; $('feedback').classList.toggle('error', error); }
function clearResults() { outputURLs.forEach(url => URL.revokeObjectURL(url)); outputURLs = []; outputs = []; $('results').hidden = true; $('resultList').replaceChildren(); }
function setTab(name) {
  activeTab = name;
  for (const tab of document.querySelectorAll('[data-tab]')) tab.setAttribute('aria-pressed', String(tab.dataset.tab === name));
  for (const id of ['merge', 'split', 'viewer', 'local']) $(id).hidden = id !== name;
  const readingOnly = name === 'viewer' || name === 'local';
  $('toolFooter').hidden = readingOnly; $('results').hidden = readingOnly || !outputs.length;
  $('feedback').hidden = readingOnly;
  window.scrollTo(0, 0);
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  if (name === 'viewer' && !$('gridFrame').getAttribute('src')) $('gridFrame').src = '../';
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
    row.append(title, button('격자로 보기', `${file.name} 격자로 보기`, () => run(() => preview(file))), link); $('resultList').append(row);
  }
  message('완료했습니다. 파일을 받거나 격자 보기에서 결과를 확인하세요.'); $('results').scrollIntoView({behavior: 'smooth', block: 'nearest'});
}
async function preview(file) {
  const frame = $('gridFrame');
  if (!frame.contentWindow?.openFile) {
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('뷰어를 불러오지 못했습니다. PDF를 다운로드해 확인해 주세요.')), 20000); frame.addEventListener('load', () => { clearTimeout(timer); resolve(); }, {once: true}); if (!frame.getAttribute('src')) frame.src = '../'; });
  }
  setTab('viewer'); await frame.contentWindow.openFile(new File([file.bytes], file.name, {type: 'application/pdf'}));
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
  const blob = await zip.generateAsync({type: 'blob'}), link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'pdf-grid-split.zip'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 60000); message('ZIP 다운로드를 시작했습니다.');
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
if (!lib || !core || !window.JSZip) { message('PDF 도구를 불러오지 못했습니다. 페이지를 새로고침해 주세요.', true); document.querySelectorAll('button').forEach(el => el.disabled = true); } else refresh();

window.addEventListener('hashchange', () => { if (!busy && ['merge', 'split', 'viewer', 'local'].includes(location.hash.slice(1))) setTab(location.hash.slice(1)); });
setTab(['merge', 'split', 'viewer', 'local'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'merge');
