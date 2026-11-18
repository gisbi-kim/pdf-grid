'use strict';
window.PDFGridReload = (() => {
  let currentTab, isBusy;
  const refreshing = new WeakSet();
  async function refresh(tab = currentTab()) {
    if (isBusy() || document.querySelector('#updateDialog[open]') ||
        tab?.removed || tab?.restoring || tab?.loading || tab?.pendingFile ||
        tab && refreshing.has(tab)) return;
    if (!tab?.hasFile) { location.reload(); return; }
    if (tab.saved) return window.PDFGridSession.load(tab);
    refreshing.add(tab);
    const button = tab.reload;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const viewer = tab.frame.contentWindow;
    try {
      const state = viewer.gridReloadState();
      tab.refreshState = state;
      const original = tab.file || viewer.gridReloadFile();
      let file, disk = false;
      if (original?.pdfGridSourceID) {
        const source = await window.pdfGridDesktop.refreshPDF(original.pdfGridSourceID);
        file = new File([source.bytes], source.name, {type:'application/pdf'});
        file.pdfGridSourceID = source.sourceID;
        disk = true;
      } else if (original?.pdfGridHandle) {
        file = await original.pdfGridHandle.getFile();
        file.pdfGridHandle = original.pdfGridHandle;
        disk = true;
      } else {
        // Generated PDFs have no disk source; keep their in-memory result intact.
        file = original;
      }
      if (tab.removed) return;
      if (!file) throw new Error('원본 PDF를 다시 열어 주세요.');
      if (await viewer.openFile(file, state, false) && !tab.removed) {
        tab.file = file;
        await window.PDFGridSession.keep(tab,file);
        if (tab.removed) return;
        viewer.notice(disk ? '최신 PDF를 다시 불러왔습니다.' : 'PDF 화면을 새로고침했습니다.');
      }
    } catch (error) {
      if (!tab.removed) viewer.notice('새로고침하지 못했습니다. 기존 PDF는 유지됩니다. ' + (error.message || '빌드가 끝난 뒤 다시 시도해 주세요.'));
    } finally {
      refreshing.delete(tab);
      tab.refreshState = null;
      if (!tab.removed) {
        button.disabled = !tab.hasFile;
        button.removeAttribute('aria-busy');
      }
    }
  }
  function bind(doc) {
    if (!window.pdfGridDesktop) return;
    doc.addEventListener('keydown', event => {
      const modifier = event.metaKey ? window.pdfGridDesktop.platform === 'darwin' && !event.ctrlKey : event.ctrlKey;
      const reload = event.key === 'F5' || (modifier && event.key.toLowerCase() === 'r');
      if (!reload || event.altKey || (event.metaKey && !modifier)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) void refresh();
    }, true);
  }
  return {setup(getTab, busy) {
    currentTab = getTab; isBusy = busy; bind(document);
  }, bind, refresh};
})();
