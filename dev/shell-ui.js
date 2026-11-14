'use strict';
window.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('devStatus');
  const status = document.getElementById('versionStatus');
  function close() { status.hidden = true; button.setAttribute('aria-expanded', 'false'); }
  function show() {
    status.hidden = false;
    const rect = button.getBoundingClientRect();
    status.style.left = Math.max(8, Math.min(rect.left, innerWidth - status.offsetWidth - 8)) + 'px';
    // The ribbon is at the top edge: place the popover immediately below its button.
    status.style.top = rect.bottom + 8 + 'px';
    button.setAttribute('aria-expanded', 'true');
  }
  button.addEventListener('click', show);
  button.addEventListener('mouseenter', show);
  button.addEventListener('mouseleave', close);
  button.addEventListener('focus', show);
  button.addEventListener('blur', close);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  document.addEventListener('pointerdown', event => { if (!button.contains(event.target)) close(); });
  window.addEventListener('resize', close);
  const github = document.getElementById('githubLink');
  if (window.pdfGridDesktop) {
    document.getElementById('desktopDownload').hidden = true;
    github.addEventListener('click', event => {
      event.preventDefault();
      window.pdfGridDesktop.openExternal(github.href).catch(error => {
        status.textContent = error.message || 'GitHub를 열지 못했습니다.';
        show();
      });
    });
  }
});
