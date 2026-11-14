'use strict';
window.addEventListener('DOMContentLoaded',()=>{
 const api=window.pdfGridDesktop;if(!api?.checkForUpdates)return;
 const style=document.createElement('style');style.textContent=`
 .updateCheck{width:40px;height:40px;min-width:40px;border:0!important;border-radius:50%!important;background:#3d82f6!important;color:white!important;padding:9px!important;margin-left:auto;display:grid;place-items:center;cursor:pointer}.updateCheck:hover{background:#2469dc!important}.updateCheck svg{width:22px;height:22px}.updateCheck:focus-visible{outline:3px solid #a9ccff;outline-offset:3px}
 #updateDialog{width:min(440px,calc(100vw - 32px));border:1px solid #607647;border-radius:14px;background:#20252b;color:#e5e9ed;padding:24px;box-shadow:0 12px 45px #0008;font:14px/1.6 sans-serif}#updateDialog::backdrop{background:#0007}#updateDialog h2{font-size:18px;margin:0 0 14px}#updateStatus{white-space:pre-line;margin:0 0 20px}#updateDialog .updateActions{display:flex;justify-content:flex-end;gap:10px}#updateDialog button{font:inherit;border:1px solid #607647;border-radius:7px;padding:8px 12px;background:#303740;color:inherit;cursor:pointer}#updateDialog button.primary{background:#c7f481;color:#172516}#updateDialog button:disabled{opacity:.5;cursor:default}#updateDialog.busy h2::after{content:'';display:inline-block;width:12px;height:12px;margin-left:10px;border:2px solid #71874e;border-top-color:#c7f481;border-radius:50%;animation:updateSpin .8s linear infinite}@keyframes updateSpin{to{transform:rotate(360deg)}}`;
 document.head.append(style);
 const button=document.createElement('button');button.id='checkForUpdates';button.className='updateCheck';button.type='button';button.title='최신 버전 확인';button.setAttribute('aria-label','최신 버전 확인');button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v10m-4-4 4 4 4-4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>';
 (document.querySelector('nav.appRibbon')||document.body).append(button);
 const dialog=document.createElement('dialog');dialog.id='updateDialog';dialog.setAttribute('aria-labelledby','updateHeading');
 const heading=document.createElement('h2');heading.id='updateHeading';heading.textContent='최신 버전 확인';
 const status=document.createElement('p');status.id='updateStatus';status.setAttribute('role','status');
 const actions=document.createElement('div');actions.className='updateActions';const close=document.createElement('button');close.id='updateClose';close.textContent='닫기';const install=document.createElement('button');install.id='installUpdate';install.className='primary';install.textContent='업데이트 설치';install.hidden=true;actions.append(close,install);dialog.append(heading,status,actions);document.body.append(dialog);
 let latest=null,installing=false,checking=false;
 close.onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>{if(installing)e.preventDefault()});
 button.onclick=async()=>{
  if(installing||checking)return;checking=true;button.disabled=true;latest=null;install.hidden=true;dialog.classList.add('busy');status.textContent='인터넷으로 최신 버전을 확인하는 중입니다…';if(!dialog.open)dialog.showModal();
  try{latest=await api.checkForUpdates();const latestLabel=latest.latestVersion+(latest.latestBuild?' (빌드 '+latest.latestBuild+')':''),currentLabel=latest.currentVersion+(latest.currentBuild?' (빌드 '+latest.currentBuild+')':'');status.textContent=latest.available?`새 버전 ${latestLabel}을 설치할 수 있습니다.\n현재 버전: ${currentLabel}`:latest.canInstall?`현재 ${latest.currentVersion} 버전이 최신입니다.\n필요하면 최신 설치 파일로 다시 설치할 수 있습니다.`:`현재 버전 ${latest.currentVersion}은 공개된 버전보다 새롭습니다.`;install.hidden=!latest.canInstall;install.textContent=latest.available?'업데이트 설치':'최신 버전 다시 설치'}catch(error){status.textContent=(error.message||'인터넷 연결을 확인하고 다시 시도해 주세요.')+'\n현재 앱은 계속 사용할 수 있습니다.'}finally{dialog.classList.remove('busy');checking=false;button.disabled=false}
 };
 install.onclick=async()=>{
  if(!latest||installing)return;
  if(!confirm('작업 중인 결과를 먼저 저장해 주세요.\n설치 파일 다운로드와 확인이 끝나면 현재 앱을 닫고 설치 프로그램을 실행할까요?'))return;
  installing=true;close.disabled=install.disabled=true;dialog.classList.add('busy');status.textContent='최신 설치 파일을 다운로드하고 확인하는 중입니다…';
  try{await window.PDFGridSession?.flush();await api.installUpdate(latest.tag);status.textContent='설치 프로그램을 실행합니다…'}catch(error){status.textContent=error.message||'설치 파일을 받지 못했습니다. 다시 시도해 주세요.';installing=false;close.disabled=install.disabled=false;dialog.classList.remove('busy')}
 };
});
