const {chromium}=require('playwright-core');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const exe=path.resolve(process.argv[2]||'PDF-Grid.exe');
 const started=Date.now();
 const app=spawn(exe,[],{env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223 --remote-allow-origins=*'},stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<100;i++){
   if(app.exitCode!==null)throw new Error('Native app exited: '+app.exitCode);
   try{browser=await chromium.connectOverCDP('http://127.0.0.1:9223');break}catch{await new Promise(r=>setTimeout(r,200))}
  }
  assert(browser,'WebView2 did not expose a running window');
  const context=browser.contexts()[0];let page;
  for(let i=0;i<100;i++){
   page=context.pages().find(p=>p.url().includes('49383/dev/'));
   if(page)break;await new Promise(r=>setTimeout(r,100));
  }
  assert(page,'Native viewer page missing');
  await page.waitForFunction(()=>window.pdfGridDesktop && document.querySelector('iframe'));
  const latency=Date.now()-started;
  await page.screenshot({path:'tests/native-startup.png'});
  console.log('Native window and viewer ready in',latency,'ms (CI host; not a user-device benchmark)');
  await page.getByRole('button',{name:'PDF 합치기',exact:true}).click();
  await page.locator('#mergeDemo').click();
  await page.waitForFunction(()=>document.querySelectorAll('#mergeList .fileRow').length===2 || !document.querySelector('#mergeRun').disabled);
  await page.locator('#mergeRun').click();
  await page.waitForFunction(()=>!document.querySelector('#results').hidden);
  const merged=await page.evaluate(async()=>{
   const a=document.querySelector('#resultList a.download');const bytes=new Uint8Array(await(await fetch(a.href)).arrayBuffer());
   const pdf=await PDFLib.PDFDocument.load(bytes);return pdf.getPageCount();
  });assert.equal(merged,5);
  await page.getByRole('button',{name:'PDF 분리하기',exact:true}).click();
  await page.locator('#splitDemo').click();
  await page.waitForFunction(()=>!document.querySelector('#splitRun').disabled);
  await page.locator('#splitRun').click();
  await page.waitForFunction(()=>document.querySelectorAll('#resultList a.download').length===2);
  await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=10;c.height=8;c.getContext('2d').fillRect(0,0,10,8);
   const blob=await new Promise(r=>c.toBlob(r,'image/png'));
   if(!await pdfGridDesktop.copyPDFImage(new Uint8Array(await blob.arrayBuffer())))throw new Error('Native clipboard failed');
  });
  // A second process must forward the explicitly requested PDF to the existing window.
  const sample=await page.evaluate(async()=>{const p=await PDFLib.PDFDocument.create();p.addPage();return Array.from(await p.save())});
  const samplePath=path.resolve('tests/시작-테스트.pdf');fs.writeFileSync(samplePath,Buffer.from(sample));
  const second=spawn(exe,[samplePath],{stdio:'ignore'});await new Promise((resolve,reject)=>{second.once('exit',resolve);second.once('error',reject)});
  await page.waitForFunction(()=>document.querySelector('#pdfTabList').textContent.includes('시작-테스트.pdf'));
  await page.screenshot({path:'tests/native-pdf-open.png'});
  fs.writeFileSync('tests/startup.json',JSON.stringify({nativeViewerReadyMs:latency,mergedPages:merged,splitFiles:2,clipboard:true,secondInstancePDF:true},null,2));
  console.log('PASS native WebView2: merge, split, clipboard and second-instance Korean PDF open');
 }finally{if(browser)await browser.close();app.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
