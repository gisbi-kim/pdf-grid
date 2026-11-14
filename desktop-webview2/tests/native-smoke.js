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
   const pdfBytes=await createPDFGridFixture(PDFLib,24);await nativeTestStage('second:'+btoa(String.fromCharCode(...pdfBytes)));
   await until(()=>document.querySelector('#pdfTabList').textContent.includes('startup-test.pdf'));
   const frame=document.querySelector('.pdfTabPanel[aria-hidden="false"] iframe').contentWindow;
   await until(()=>frame.document.querySelectorAll('.sheet').length===24);
   const stage=frame.document.querySelector('#stage');
   for(const rows of [1,2,10]){
    frame.setGridViewportRows(rows);frame.go(1);stage.focus();let steps=0;
    while(!frame.document.querySelector('#next').disabled){const before=stage.scrollTop;stage.dispatchEvent(new frame.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));if(stage.scrollTop<=before)throw new Error('Right arrow stalled');if(++steps>40)throw new Error('Forward navigation did not reach bottom');await sleep(10)}
    steps=0;while(!frame.document.querySelector('#prev').disabled){const before=stage.scrollTop;stage.dispatchEvent(new frame.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));if(stage.scrollTop>=before)throw new Error('Left arrow stalled');if(++steps>40)throw new Error('Backward navigation did not reach top');await sleep(10)}
   }
   frame.setGridViewportRows(1);frame.go(1);
   await until(()=>frame.document.querySelector('.sheet .pdfLinkLayer')?.children.length===3);
   frame.document.querySelector('.sheet .pdfLink').click();await until(()=>frame.document.querySelector('.sheet.selected .num')?.textContent==='10');
   frame.go(1);await until(()=>frame.document.querySelector('.sheet .pdfLinkLayer')?.children.length===3);frame.document.querySelectorAll('.sheet .pdfLink')[1].click();await until(()=>frame.document.querySelector('.sheet.selected .num')?.textContent==='4');
   frame.document.querySelector('#outlineToggle').click();frame.document.querySelector('#pdfOutline a').click();await until(()=>frame.document.querySelector('#pdfOutline').hidden&&frame.document.querySelector('.sheet.selected .num')?.textContent==='4');
   frame.go(1);await until(()=>frame.document.querySelector('.sheet .pdfLinkLayer')?.children.length===3);frame.document.querySelector('.sheet a[href="https://example.com/pdf-link"]').click();await sleep(100);
   frame.go(1);await until(()=>frame.document.querySelectorAll('.sheet')[1]?.querySelector('.pdfLink'));
   const citation=frame.document.querySelectorAll('.sheet')[1].querySelector('.pdfLink');citation.dispatchEvent(new frame.MouseEvent('mouseenter'));
   await until(()=>frame.document.querySelector('#citationCard')?.textContent.includes('Reliable Robot Mapping'));
   if(frame.document.querySelector('#citationCard').textContent.includes('Unrelated'))throw Error('Citation preview included another reference');
   const card=frame.document.querySelector('#citationCard');
   if(card.querySelector('.citationCount').textContent!=='1 / 2')throw Error('Grouped citation paging missing');
   if(card.querySelector('.citationTitle').textContent!=='A Study of Reliable Robot Mapping')throw Error('Citation title was not parsed');
   card.querySelector('a.doi').click();await sleep(100);
   card.querySelector('[aria-label="다음 인용"]').click();
   if(card.querySelector('.citationCount').textContent!=='2 / 2')throw Error('Next reference missing');
   card.querySelector('a.arxiv').click();await sleep(100);
   card.querySelector('[aria-label="이전 인용"]').click();
   citation.click();await until(()=>frame.document.querySelector('.sheet.selected .num')?.textContent==='24');
   frame.document.dispatchEvent(new frame.KeyboardEvent('keydown',{key:'[',bubbles:true}));await until(()=>frame.document.querySelector('.sheet.selected .num')?.textContent==='2');
   await nativeTestStage('navigation-forward');await until(()=>frame.document.querySelector('.sheet.selected .num')?.textContent==='24');
   await nativeTestStage('mouse-back');await until(()=>frame.document.querySelector('.sheet.selected .num')?.textContent==='2');
   await nativeTestStage('mouse-forward');await until(()=>frame.document.querySelector('.sheet.selected .num')?.textContent==='24');
   await nativeTestStage('navigation-back');await until(()=>frame.document.querySelector('.sheet.selected .num')?.textContent==='2');
   const originalTabCount=document.querySelectorAll('#pdfTabList [role=tab]').length;
   frame.go(10);await sleep(100);const previousScroll=stage.scrollTop;
   for(const [key,count] of [['reload-f5',25],['reload-ctrl-r',26],['reload-button',27]]){
    const rebuilt=await createPDFGridFixture(PDFLib,count);
    frame.document.querySelector('#toast').textContent='';
    if(key==='reload-f5')stage.focus();else document.querySelector('#devStatus').focus();
    await nativeTestStage(key+':'+btoa(String.fromCharCode(...rebuilt)));
    if(key==='reload-button')document.querySelector('#reloadPDF').click();
    await until(()=>frame.document.querySelectorAll('.sheet').length===count && frame.document.querySelector('#toast').textContent==='최신 PDF를 다시 불러왔습니다.');
    if(document.querySelectorAll('#pdfTabList [role=tab]').length!==originalTabCount)throw new Error('Reload lost open tabs');
    if(Math.abs(stage.scrollTop-previousScroll)>4)throw new Error('Reload lost reading position: '+key+' '+previousScroll+' -> '+stage.scrollTop);
   }
   for(const source of ['window-forward','window-picker']){
    const modes=source==='window-forward'?['normal','maximized','minimized-normal','minimized-maximized']:['normal','maximized'];
    for(const mode of modes){
     const beforeTabs=document.querySelectorAll('#pdfTabList [role=tab]').length;
     await nativeTestStage(source+':'+mode+':'+btoa(String.fromCharCode(...pdfBytes)));
     if(source==='window-picker')await window.pickPdfTabs();
     const name=source+'-'+mode+'.pdf';
     await until(()=>document.querySelector('#pdfTabList').textContent.includes(name));
     await sleep(100);
     if(document.querySelectorAll('#pdfTabList [role=tab]').length!==beforeTabs+1)throw new Error('PDF open did not add exactly one tab');
     await nativeTestStage('assert-window');
    }
   }
   document.querySelector('#checkForUpdates').click();await until(()=>!document.querySelector('#installUpdate').hidden);
   if(!document.querySelector('#updateStatus').textContent.includes('9.9.9'))throw new Error('Update UI did not show latest version');
   document.querySelector('#updateClose').click();const latest=await pdfGridDesktop.checkForUpdates();
   // The native host records the verified launch handoff and exits its UI loop.
   // The test launcher never executes a real installer from this test window.
   await pdfGridDesktop.installUpdate(latest.tag);
  }catch(e){await nativeTestDone(String(e.stack||e))}
 });
})();
