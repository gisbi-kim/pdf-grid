(function(){
 if(window.top!==window)return;
 const begin=()=>{
  window.__pdfGridBenchSignal('ui');
  // Version 1.1.0 starts on Merge. Compare the same functional target by
  // selecting Grid immediately after the original default UI has initialized.
  const viewer=document.querySelector('[data-tab="viewer"]');
  if(viewer?.getAttribute('aria-pressed')!=='true')viewer.click();
  let complete=false;
  function poll(){
   if(complete)return;
   const frame=document.querySelector('iframe');
   try{
    if(frame && frame.contentWindow.location.href!=='about:blank' && frame.contentDocument.readyState==='complete' && frame.contentWindow.pdfjsLib && frame.contentDocument.querySelector('#stage')){
     complete=true;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__pdfGridBenchSignal('ready')));return;
    }
   }catch{}
   setTimeout(poll,10);
  }
  poll();
 };
 if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
})();
