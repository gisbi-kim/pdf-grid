'use strict';
window.PDFGridTabMenu = (() => {
  const menu = document.createElement('div');
  menu.id = 'pdfTabContextMenu'; menu.className = 'tabContextMenu'; menu.hidden = true; menu.tabIndex = -1;
  menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'PDF 탭 메뉴');
  const copy = document.createElement('button'); copy.type = 'button'; copy.setAttribute('role', 'menuitem');
  copy.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8" height="9" rx="1.5"/><path d="M10 5V2.5A1.5 1.5 0 0 0 8.5 1h-6A1.5 1.5 0 0 0 1 2.5v7A1.5 1.5 0 0 0 2.5 11H5"/></svg><span>절대경로 복사</span>';
  const note = document.createElement('p'); note.id = 'tabPathCopyReason'; note.className = 'tabMenuReason';
  const split = document.createElement('button'); split.type='button'; split.setAttribute('role','menuitem'); split.textContent='나란히 보기';
  const reopen = document.createElement('button'); reopen.type='button'; reopen.setAttribute('role','menuitem'); reopen.textContent='닫은 탭 복원';
  menu.append(copy, note, split, reopen);
  const status = document.createElement('div'); status.id = 'tabMenuStatus'; status.className = 'tabMenuStatus'; status.hidden = true;
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  document.body.append(menu, status);
  let target = null, statusTimer;
  function sourceID(tab) {
    return tab.saved?.sourceID || (tab.file || tab.frame.contentWindow?.gridReloadFile?.())?.pdfGridSourceID;
  }
  function close(restoreFocus = false) {
    const previous = target; target = null; menu.hidden = true;
    previous?.button.setAttribute('aria-expanded', 'false');
    if (restoreFocus && previous?.button.isConnected) previous.button.focus();
  }
  function message(text) { clearTimeout(statusTimer); status.textContent = text; status.hidden = false; statusTimer = setTimeout(() => { status.hidden = true; }, 3500); }
  function open(tab, x, y) {
    close(); target = tab;
    const reason = !tab.hasFile ? 'PDF를 먼저 열어 주세요.' : !window.pdfGridDesktop?.copyPDFPath ? '웹에서는 전체 파일 경로를 알 수 없습니다.' : !sourceID(tab) ? '원본 경로가 없는 PDF입니다. 앱의 PDF 열기로 파일을 열어 주세요.' : '';
    copy.disabled = !!reason; note.textContent = reason; note.hidden = !reason;
    split.disabled = !window.PDFGridTabs?.canSplit(tab); reopen.disabled = !window.PDFGridTabs?.canReopen();
    copy.setAttribute('aria-describedby', note.id);
    menu.hidden = false; tab.button.setAttribute('aria-expanded', 'true');
    menu.style.left = Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8)) + 'px';
    (menu.querySelector('button:not(:disabled)') || menu).focus({preventScroll:true});
  }
  copy.onclick = async () => {
    const tab = target; if (!tab || copy.disabled) return;
    const id = sourceID(tab); close(true);
    try {
      if (!id || !await window.pdfGridDesktop.copyPDFPath(id)) throw new Error('클립보드에 복사하지 못했습니다.');
      message('절대경로를 복사했습니다.');
    } catch (error) { message('경로 복사 실패: ' + (error.message || '다시 시도해 주세요.')); }
  };
  split.onclick = () => { const tab=target; close(); if(tab)void window.PDFGridTabs.split(tab); };
  reopen.onclick = () => { close(); void window.PDFGridTabs.reopen(); };
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === 'Tab') close(true);
    else if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault(); const items=[...menu.querySelectorAll('button:not(:disabled)')],index=items.indexOf(document.activeElement);
      const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?-1:1)+items.length)%items.length;
      items[next]?.focus();
    }
  });
  document.addEventListener('pointerdown', event => { if (!menu.contains(event.target)) close(); }, true);
  window.addEventListener('blur', () => close()); window.addEventListener('resize', () => close());
  window.addEventListener('scroll', event => { if (!menu.contains(event.target)) close(); }, true);
  return {close, bind(view) { view.addEventListener('pointerdown', () => close(), true); }, attach(tab) {
    tab.button.setAttribute('aria-haspopup', 'menu'); tab.button.setAttribute('aria-expanded', 'false');
    tab.button.addEventListener('contextmenu', event => {
      event.preventDefault(); event.stopPropagation(); const rect = tab.button.getBoundingClientRect();
      open(tab, event.clientX || rect.left, event.clientY || rect.bottom);
    });
    tab.button.addEventListener('keydown', event => {
      if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') {
        event.preventDefault(); event.stopPropagation(); const rect = tab.button.getBoundingClientRect(); open(tab, rect.left, rect.bottom);
      }
    });
  }};
})();
