'use strict';
window.PDFGridReload = (() => {
  let currentTab, isBusy, refreshing = false;
  async function refresh() {
    if (refreshing || isBusy() || document.querySelector('#updateDialog[open]')) return;
    const tab = currentTab();
    if (!tab?.hasFile) { location.reload(); return; }
    refreshing = true;
    const viewer = tab.frame.contentWindow;
    try {
      const state = viewer.gridReloadState();
      let file, disk = false;
      if (tab.file?.pdfGridSourceID) {
        const source = await window.pdfGridDesktop.refreshPDF(tab.file.pdfGridSourceID);
        file = new File([source.bytes], source.name, {type:'application/pdf'});
        file.pdfGridSourceID = source.sourceID;
        disk = true;
      } else if (tab.file?.pdfGridHandle) {
        file = await tab.file.pdfGridHandle.getFile();
        file.pdfGridHandle = tab.file.pdfGridHandle;
        disk = true;
      } else {
        // Generated PDFs have no disk source; keep their in-memory result intact.
        file = tab.file;
      }
      if (!file) throw new Error('원본 PDF를 다시 열어 주세요.');
      if (await viewer.openFile(file, state)) {
        tab.file = file;
        viewer.notice(disk ? '최신 PDF를 다시 불러왔습니다.' : 'PDF 화면을 새로고침했습니다.');
      }
    } catch (error) {
      viewer.notice('새로고침하지 못했습니다. 기존 PDF는 유지됩니다. ' + (error.message || '빌드가 끝난 뒤 다시 시도해 주세요.'));
    } finally { refreshing = false; }
  }
  function bind(doc) {
    if (!window.pdfGridDesktop) return;
    doc.addEventListener('keydown', event => {
      const reload = event.key === 'F5' || (event.ctrlKey && event.key.toLowerCase() === 'r');
      if (!reload || event.altKey || event.metaKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) void refresh();
    }, true);
  }
  return {setup(getTab, busy) { currentTab = getTab; isBusy = busy; bind(document); }, bind, refresh};
})();
