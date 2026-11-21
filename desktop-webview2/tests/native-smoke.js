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
   await until(()=>document.querySelector('#pdfTabList').textContent.includes('연구 논문 📄.pdf'));
   const frame=document.querySelector('.pdfTabPanel[aria-hidden="false"] iframe').contentWindow;
   await until(()=>frame.document.querySelectorAll('.sheet').length===24);
   const stage=frame.document.querySelector('#stage');
   const pathTab=document.querySelector('#pdfTabList [aria-selected="true"]');
   pathTab.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:180,clientY:30}));
   const copyPath=document.querySelector('#pdfTabContextMenu [role="menuitem"]');
   if(!copyPath||copyPath.disabled)throw Error('Original PDF path command missing');
   copyPath.click();await until(()=>document.querySelector('#tabMenuStatus').textContent==='절대경로를 복사했습니다.');
   await nativeTestStage('assert-path-copy');
   frame.setGridViewportRows(2);frame.go(5);
   frame.document.querySelector('button[data-mode="text"]').click();
   await until(()=>frame.document.querySelectorAll('.sheet')[4]?.querySelector('.searchTextLayer span'));
   const word=frame.document.querySelectorAll('.sheet')[4].querySelector('.searchTextLayer span'),range=frame.document.createRange();
   range.selectNodeContents(word);frame.getSelection().removeAllRanges();frame.getSelection().addRange(range);
   const selectionText=frame.getSelection().toString(),selectionScale=frame.gridReloadState().view.scale,selectionTop=stage.scrollTop,selectionLeft=stage.scrollLeft;
   word.dispatchEvent(new frame.MouseEvent('dblclick',{bubbles:true,cancelable:true,detail:2}));
   if(frame.gridReloadState().view.scale!==selectionScale||stage.scrollTop!==selectionTop||stage.scrollLeft!==selectionLeft||frame.getSelection().toString()!==selectionText)throw Error('Text double-click changed selection, zoom or scroll');
   frame.document.querySelector('button[data-mode="area"]').click();
   frame.document.querySelectorAll('.sheet')[4].dispatchEvent(new frame.MouseEvent('dblclick',{bubbles:true,cancelable:true,detail:2}));
   if(frame.gridReloadState().view.scale!==selectionScale||stage.scrollTop!==selectionTop)throw Error('Area double-click zoomed the page');
   frame.document.querySelector('button[data-mode="hand"]').click();
   const searchInput=frame.document.querySelector('#searchInput');searchInput.value='Page 1';searchInput.dispatchEvent(new frame.Event('input',{bubbles:true}));
   await until(()=>frame.document.querySelector('.searchTextLayer mark.active'));
   frame.setGridViewportRows(1);frame.go(3);await sleep(100);
   const zoomY=stage.clientHeight*.45,zoomAnchor=(stage.scrollTop+zoomY-32)/frame.gridReloadState().view.scale;
   const zoomRect=stage.getBoundingClientRect();
   stage.dispatchEvent(new frame.WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-120,clientX:zoomRect.left+stage.clientWidth*.7,clientY:zoomRect.top+zoomY}));
   await sleep(100);
   const wheelScale=frame.gridReloadState().view.scale;
   if(Math.abs((stage.scrollTop+zoomY-32)/wheelScale-zoomAnchor)*wheelScale>2)throw Error('Ctrl+wheel jumped to an old search result');
   searchInput.value='';searchInput.dispatchEvent(new frame.Event('input',{bubbles:true}));
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
    if(key==='reload-button')document.querySelector('.pdfTab:has([aria-selected="true"]) .pdfTabReload').click();
    await until(()=>frame.document.querySelectorAll('.sheet').length===count && frame.document.querySelector('#toast').textContent==='최신 PDF를 다시 불러왔습니다.');
    if(document.querySelectorAll('#pdfTabList [role=tab]').length!==originalTabCount)throw new Error('Reload lost open tabs');
    if(Math.abs(stage.scrollTop-previousScroll)>4)throw new Error('Reload lost reading position: '+key+' '+previousScroll+' -> '+stage.scrollTop);
   }
   if(document.querySelector('#reloadPDF'))throw Error('Separate ribbon refresh button remains');
   const sourceTab=document.querySelector('.pdfTab:has([aria-selected="true"])');
   await openPdfTabs([new File([pdfBytes],'Other-reading.pdf',{type:'application/pdf'})]);
   const otherFrame=document.querySelector('.pdfTabPanel[aria-hidden="false"] iframe').contentWindow;
   otherFrame.setGridViewportRows(1);otherFrame.go(7);await sleep(100);
   const otherView=JSON.stringify(otherFrame.gridReloadState());
   sourceTab.querySelector('[role=tab]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:180,clientY:30}));
   document.querySelector('#tabMenuStatus').textContent='';
   document.querySelector('#pdfTabContextMenu [role="menuitem"]').click();
   await until(()=>document.querySelector('#tabMenuStatus').textContent==='절대경로를 복사했습니다.');
   await nativeTestStage('assert-path-copy');
   if(document.querySelector('.pdfTabPanel[aria-hidden="false"] iframe').contentWindow!==otherFrame)throw Error('Copying a background path switched tabs');
   frame.document.querySelector('#toast').textContent='';
   await nativeTestStage('reload-button:'+btoa(String.fromCharCode(...await createPDFGridFixture(PDFLib,28))));
   sourceTab.querySelector('.pdfTabReload').click();
   if(!sourceTab.querySelector('.pdfTabReload').disabled)throw Error('Refresh icon did not indicate progress');
   await until(()=>frame.document.querySelectorAll('.sheet').length===28&&frame.document.querySelector('#toast').textContent==='최신 PDF를 다시 불러왔습니다.');
   if(document.querySelector('.pdfTabPanel[aria-hidden="false"] iframe').contentWindow!==otherFrame||JSON.stringify(otherFrame.gridReloadState())!==otherView)throw Error('Background refresh changed the active tab or its view');
   if(document.querySelectorAll('#pdfTabList [role=tab]').length!==originalTabCount+1)throw Error('Background refresh changed tab count');
   sourceTab.querySelector('[role=tab]').click();
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
   let lastClosed;
   for(const focus of ['pdf','ribbon','search']){
    const active=document.querySelector('#pdfTabList [aria-selected="true"]'),before=document.querySelectorAll('#pdfTabList [role=tab]').length;
    const view=document.querySelector('.pdfTabPanel[aria-hidden="false"] iframe').contentDocument;
    lastClosed={name:active.textContent,state:view.defaultView.gridReloadState(),index:[...document.querySelectorAll('#pdfTabList [role=tab]')].indexOf(active)};
    (focus==='ribbon'?document.querySelector('#devStatus'):view.querySelector(focus==='search'?'#searchInput':'#stage')).focus();
    await nativeTestStage('close-tab');
    await until(()=>document.querySelectorAll('#pdfTabList [role=tab]').length===before-1);
    if(active.isConnected||document.querySelectorAll('#pdfTabList [aria-selected="true"]').length!==1)throw Error('Ctrl+W did not close exactly the active PDF tab');
   }
   document.querySelector('#devStatus').focus();await nativeTestStage('reopen-tab');
   await until(()=>!document.querySelector('#reopenPDFTab').hasAttribute('aria-busy')&&document.querySelector('#pdfTabList [aria-selected="true"]')?.textContent===lastClosed.name);
   const reopened=document.querySelector('.pdfTabPanel[data-active="true"] iframe').contentWindow,restoredView=reopened.gridReloadState();
   if(Math.abs(restoredView.view.top-lastClosed.state.view.top)>4||Math.abs(restoredView.view.scale-lastClosed.state.view.scale)>.002||JSON.stringify(restoredView.navigation)!==JSON.stringify(lastClosed.state.navigation))throw Error('Ctrl+Shift+T did not restore the reading state');
   if([...document.querySelectorAll('#pdfTabList [role=tab]')].findIndex(t=>t.textContent===lastClosed.name)!==lastClosed.index)throw Error('Closed tab order was not restored');
   const selectedTab=document.querySelector('#pdfTabList [aria-selected=true]');
   const otherTab=[...document.querySelectorAll('#pdfTabList [role=tab]')].find(tab=>tab!==selectedTab);
   const pointOn=(element,fraction=.5)=>{
    const rect=element.getBoundingClientRect();
    return [rect.left+rect.width*fraction,rect.top+rect.height/2].map(value=>Math.round(value*devicePixelRatio));
   };
   const singleFrame=document.querySelector('.pdfTabPanel[aria-hidden=false] iframe');
   await nativeTestStage('drag-pane-tab:'+ [...pointOn(otherTab),...pointOn(singleFrame,.75)].join(','));
   await until(()=>document.querySelector('.splitRight')?.getAttribute('aria-labelledby')===otherTab.id);
   if(document.querySelectorAll('.pdfTabPanel[aria-hidden="false"]').length!==2)throw Error('Two PDFs were not displayed side by side');
   const leftPane=document.querySelector('.splitLeft iframe').contentWindow,rightPane=document.querySelector('.splitRight iframe').contentWindow;
   if(leftPane!==reopened)throw Error('Dragging to start split view moved the current PDF to the wrong side');
   await pendingPdfLayout;
   const leftState=leftPane.gridReloadState();rightPane.go(7);await sleep(80);
   const leftAfter=leftPane.gridReloadState();
   if(leftAfter.key!==leftState.key||leftAfter.view.page!==leftState.view.page||Math.abs(leftAfter.view.top-leftState.view.top)>4||Math.abs(leftAfter.view.left-leftState.view.left)>4||Math.abs(leftAfter.view.scale-leftState.view.scale)>.002)throw Error('Scrolling the right PDF moved the left PDF: '+JSON.stringify({before:leftState,after:leftAfter}));
   if(leftAfter.navigation.index!==leftState.navigation.index||JSON.stringify(leftAfter.navigation.entries.map(entry=>entry.page))!==JSON.stringify(leftState.navigation.entries.map(entry=>entry.page)))throw Error('Scrolling the right PDF changed left link history');
   const movingPanel=document.querySelector('.splitLeft'),movingTab=document.getElementById(movingPanel.getAttribute('aria-labelledby'));
   for(const [side,opposite] of [['Right','Left'],['Left','Right']]){
    const other=document.querySelector('.split'+side),destination=other.querySelector('iframe');
    await nativeTestStage('drag-pane-tab:'+ [...pointOn(movingTab),...pointOn(destination)].join(','));
    await until(()=>movingPanel.classList.contains('split'+side));
    if(!other.classList.contains('split'+opposite)||movingPanel.querySelector('iframe').contentWindow!==leftPane)throw Error('Dragging a tab did not swap the existing PDF panes');
   }
   for(const [side,opposite] of [['Left','Right'],['Right','Left']]){
    const target=document.querySelector('.split'+side), other=document.querySelector('.split'+opposite);
    const original=document.getElementById(target.getAttribute('aria-labelledby'));
    document.getElementById(other.getAttribute('aria-labelledby')).click();
    const view=target.querySelector('iframe').contentWindow;
    const name='Drop-'+side+'.pdf';
    const transfer=new view.DataTransfer();
    transfer.items.add(new view.File([pdfBytes],name,{type:'application/pdf'}));
    view.document.querySelector('#stage').dispatchEvent(new view.DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    await until(()=>document.querySelector('.split'+side+' .pdfPaneHeading').textContent.endsWith(name));
    if(document.querySelector('.split'+opposite)!==other||!original.isConnected)throw Error('Dropping a PDF changed the opposite pane or closed the previous tab');
    const dropped=document.querySelector('.pdfTab:has([aria-selected="true"])');
    if(dropped.querySelector('[role=tab]').textContent!==name)throw Error('Dropped PDF was not selected');
    original.click();
    dropped.querySelector('button[aria-label$=" 닫기"]').click();
   }
   rightPane.document.querySelector('#stage').focus();await nativeTestStage('close-tab');
   await until(()=>!document.querySelector('#pdfTabPanels').classList.contains('splitView'));
   const beforeReopen=document.querySelectorAll('#pdfTabList [role=tab]').length;
   document.querySelector('#devStatus').focus();await nativeTestStage('reopen-tab');
   await until(()=>!document.querySelector('#reopenPDFTab').hasAttribute('aria-busy')&&document.querySelectorAll('#pdfTabList [role=tab]').length===beforeReopen+1);
   const desktop=window.pdfGridDesktop;
   // The preceding split test may have closed and reopened this document.
   const sourceName=sourceTab.querySelector('[role=tab]').textContent;
   const target=[...document.querySelectorAll('#pdfTabList [role=tab]')].find(tab=>tab.textContent===sourceName);
   if(!target)throw Error('Refresh fixture is missing');
   let releaseRefresh;
   window.pdfGridDesktop={...desktop,refreshPDF:id=>new Promise(resolve=>{releaseRefresh=()=>resolve(desktop.refreshPDF(id))})};
   try {
    target.click();
    if(target.getAttribute('aria-selected')!=='true')throw Error('Refresh fixture was not selected');
    const refreshing=PDFGridReload.refresh();
    await until(()=>!!releaseRefresh);
    target.focus();
    await nativeTestStage('close-tab');
    await until(()=>!target.isConnected);
    const remaining=()=>[...document.querySelectorAll('#pdfTabList [role=tab]')].map(tab=>[tab.id,tab.getAttribute('aria-selected')]);
    const beforeLateResult=remaining();
    releaseRefresh();
    await refreshing;
    if(target.isConnected||JSON.stringify(remaining())!==JSON.stringify(beforeLateResult))throw Error('A cancelled refresh changed the remaining tabs');
   } finally {window.pdfGridDesktop=desktop}
   while(document.querySelectorAll('#pdfTabList [role=tab]').length>1)document.querySelector('.pdfTab:has([aria-selected="true"]) button[aria-label$=" 닫기"]').click();
   document.querySelector('.pdfTabPanel[aria-hidden="false"] iframe').contentDocument.querySelector('#stage').focus();
   await nativeTestStage('close-tab');
   await until(()=>document.querySelector('#pdfTabList [role=tab]')?.textContent==='새 탭');
   document.querySelector('#devStatus').focus();await nativeTestStage('close-tab');await sleep(100);
   if(document.querySelectorAll('#pdfTabList [role=tab]').length!==1)throw Error('Closing the last tab did not retain one empty tab');
   document.querySelector('#checkForUpdates').click();await until(()=>!document.querySelector('#installUpdate').hidden);
   if(!document.querySelector('#updateStatus').textContent.includes('9.9.9'))throw new Error('Update UI did not show latest version');
   document.querySelector('#updateClose').click();const latest=await pdfGridDesktop.checkForUpdates();
   // The native host records the verified launch handoff and exits its UI loop.
   // The test launcher never executes a real installer from this test window.
   await pdfGridDesktop.installUpdate(latest.tag);
  }catch(e){await nativeTestDone(String(e.stack||e))}
 });
})();
