'use strict';
window.PDFGridSession=(()=>{
 const KEY='pdf-grid-desktop-session-v1';let adapter,dbPromise,loading=true,timer,pending=new Set();
 function database(){return dbPromise??=new Promise((resolve,reject)=>{const request=indexedDB.open('pdf-grid-desktop-tabs',1);request.onupgradeneeded=()=>request.result.createObjectStore('tabs',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
 async function transaction(mode,action){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('tabs',mode),request=action(tx.objectStore('tabs'));tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
 function warn(){adapter?.active()?.frame.contentWindow.notice('작업 상태를 저장하지 못했습니다. 저장 공간을 확인해 주세요.')}
 function metadata(){
  if(loading||!window.pdfGridDesktop)return;
  const tabs=adapter.tabs().filter(tab=>tab.file&&tab.sessionStored).map(tab=>({id:tab.sessionID,name:tab.file.name,sourceID:tab.file.pdfGridSourceID||null,state:tab.frame.contentWindow.gridReloadState()}));
  try{localStorage.setItem(KEY,JSON.stringify({version:1,tabs,active:adapter.active()?.sessionID}))}catch{warn()}
 }
 function changed(){if(loading)return;clearTimeout(timer);timer=setTimeout(metadata,180)}
 async function keep(tab,file){
  if(!window.pdfGridDesktop)return;
  tab.sessionID??=crypto.randomUUID();tab.sessionStored=false;
  const record={id:tab.sessionID,file,name:file.name,handle:file.pdfGridHandle||null};
  const write=(async()=>{try{await transaction('readwrite',store=>store.put(record))}catch(error){if(!record.handle)throw error;record.handle=null;await transaction('readwrite',store=>store.put(record))}})();
  pending.add(write);
  try{await write;tab.sessionStored=true;metadata()}catch{tab.sessionStored=!!file.pdfGridSourceID;metadata();warn()}finally{pending.delete(write)}
 }
 async function flush(){if(!window.pdfGridDesktop)return;clearTimeout(timer);await Promise.allSettled([...pending]);metadata()}
 async function start(config){
  adapter=config;window.pdfGridSessionChanged=changed;
  if(!window.pdfGridDesktop){loading=false;return}
  try{
   const saved=JSON.parse(localStorage.getItem(KEY)||'null');
   if(saved?.version===1&&Array.isArray(saved.tabs)){
    for(const meta of saved.tabs.slice(0,100)){
     if(typeof meta.id!=='string'||meta.id.length>100)continue;
     let record=null;try{record=await transaction('readonly',store=>store.get(meta.id))}catch{}let file=null,fromDisk=false;
     if(meta.sourceID)try{const source=await pdfGridDesktop.refreshPDF(meta.sourceID);file=new File([source.bytes],source.name,{type:'application/pdf'});file.pdfGridSourceID=source.sourceID;fromDisk=true}catch{}
     if(!file&&record?.handle)try{file=await record.handle.getFile();file.pdfGridHandle=record.handle;fromDisk=true}catch{}
     if(!file&&record?.file){file=new File([record.file],record.name,{type:'application/pdf'});file.pdfGridSourceID=meta.sourceID}
     if(!file)continue;
     const tab=await adapter.restore(file,meta.state,meta.id);if(!tab)continue;
     tab.sessionStored=true;
     if(meta.sourceID&&!fromDisk)tab.frame.contentWindow.notice('원본 파일을 읽지 못해 마지막으로 저장된 PDF를 복원했습니다.');
     if(fromDisk)await keep(tab,file);
    }
    const active=adapter.tabs().find(tab=>tab.sessionID===saved.active);if(active)adapter.activate(active);
   }
  }catch{warn()}finally{loading=false;metadata()}
 }
 window.addEventListener('pagehide',metadata);
 return {ready:Promise.resolve(),start(config){this.ready=start(config);return this.ready},keep,changed,flush,drop(tab){if(tab.sessionID)void transaction('readwrite',store=>store.delete(tab.sessionID)).catch(()=>{});changed()}};
})();
