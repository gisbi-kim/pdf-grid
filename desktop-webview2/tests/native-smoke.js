(function(){
 if(window.top!==window)return;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(predicate){const start=Date.now();while(!predicate()){if(Date.now()-start>20000)throw new Error('UI readiness timeout');await sleep(50)}}
 window.addEventListener('DOMContentLoaded',async()=>{
  try{
   await until(()=>window.pdfGridDesktop && document.querySelector('iframe')?.contentWindow?.pdfjsLib && document.querySelector('iframe').contentDocument.readyState==='complete');
   await nativeTestStage('ready');
   document.querySelector('[data-tab="merge"]').click();document.querySelector('#mergeDemo').click();
   await until(()=>!document.querySelector('#mergeRun').disabled);document.querySelector('#mergeRun').click();
   await until(()=>!document.querySelector('#results').hidden);
   const link=document.querySelector('#resultList a.download');const bytes=new Uint8Array(await(await fetch(link.href)).arrayBuffer());
   if((await PDFLib.PDFDocument.load(bytes)).getPageCount()!==5)throw new Error('Merged page count');
   if(!await pdfGridDesktop.saveResult(window.nativeTestFilename,bytes))throw new Error('Native save cancelled');
   document.querySelector('[data-tab="split"]').click();document.querySelector('#splitDemo').click();
   await until(()=>!document.querySelector('#splitRun').disabled);document.querySelector('#splitRun').click();
   await until(()=>document.querySelectorAll('#resultList a.download').length===2);
   const canvas=document.createElement('canvas');canvas.width=10;canvas.height=8;canvas.getContext('2d').fillRect(0,0,10,8);
   const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
   if(!await pdfGridDesktop.copyPDFImage(new Uint8Array(await blob.arrayBuffer())))throw new Error('Native clipboard');
   const pdf=await PDFLib.PDFDocument.create();pdf.addPage();await nativeTestStage('second:'+btoa(String.fromCharCode(...await pdf.save())));
   await until(()=>document.querySelector('#pdfTabList').textContent.includes('startup-test.pdf'));
   await nativeTestDone('ok');
  }catch(e){await nativeTestDone(String(e.stack||e))}
 });
})();
