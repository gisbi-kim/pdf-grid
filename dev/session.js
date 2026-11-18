'use strict';
window.PDFGridSession=(()=>{
 const KEY='pdf-grid-desktop-session-v1';let adapter,dbPromise,loading=true,timer,pending=new Set();
 let restoredMetadata = false;
 function database(){return dbPromise??=new Promise((resolve,reject)=>{const request=indexedDB.open('pdf-grid-desktop-tabs',1);request.onupgradeneeded=()=>request.result.createObjectStore('tabs',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
 async function transaction(mode,action){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('tabs',mode),request=action(tx.objectStore('tabs'));tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
 function warn(){adapter?.active()?.frame.contentWindow?.notice?.('작업 상태를 저장하지 못했습니다. 저장 공간을 확인해 주세요.')}
 function metadata(){
  if(loading||!window.pdfGridDesktop)return;
  const tabs = adapter.tabs().flatMap(tab => {
   if (tab.saved) return [tab.saved];
   if (!tab.file || !tab.sessionStored) return [];
   return [{
    id: tab.sessionID, name: tab.file.name, sourceID: tab.file.pdfGridSourceID || null,
    state: tab.frame.contentWindow.gridReloadState(), width: tab.frame.clientWidth,
   }];
  });
  try{localStorage.setItem(KEY,JSON.stringify({version:1,tabs,active:adapter.active()?.sessionID,layout:adapter.layout?.()||null}))}catch{warn()}
 }
 function changed(){if(loading)return;clearTimeout(timer);timer=setTimeout(metadata,180)}
 async function keep(tab,file){
  if(!window.pdfGridDesktop || tab.removed)return;
  tab.sessionID??=crypto.randomUUID();tab.sessionStored=false;
  const record={id:tab.sessionID,file,name:file.name,handle:file.pdfGridHandle||null};
  const write=(async()=>{try{await transaction('readwrite',store=>store.put(record))}catch(error){if(tab.removed)return;if(!record.handle)throw error;record.handle=null;await transaction('readwrite',store=>store.put(record))}})();
  pending.add(write);
  try {
   await write;
   if (!tab.removed) { tab.sessionStored = true; metadata(); }
  } catch {
   if (!tab.removed) { tab.sessionStored = !!file.pdfGridSourceID; metadata(); warn(); }
  } finally { pending.delete(write); }
 }
 async function flush(){if(!window.pdfGridDesktop)return;clearTimeout(timer);await adapter?.settle?.();await Promise.allSettled([...pending]);metadata()}
 // Startup reads only small session metadata. Inactive tabs keep their records
 // and do not read their PDF bytes or create a viewer until explicitly shown.
 function start(config) {
  adapter = config;
  window.pdfGridSessionChanged = changed;
  if (!window.pdfGridDesktop) return null;
  try {
   const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
   if (saved?.version !== 1 || !Array.isArray(saved.tabs)) return null;
   const ids = new Set();
   for (const tab of saved.tabs) {
    if (typeof tab?.id !== 'string' || tab.id.length > 100 ||
        typeof tab.name !== 'string' || !tab.name || ids.has(tab.id)) continue;
    ids.add(tab.id);
    adapter.add(tab);
   }
   restoredMetadata = true;
   return saved;
  } catch {
   warn();
   return null;
  }
 }
 async function materialize(tab, meta) {
  if (tab.removed) return false;
  const viewer = tab.frame.contentWindow;
  async function openPDF(file) {
   if (tab.removed) return false;
   const opened = await viewer.openFile(file, meta.state, false);
   if (!opened || tab.removed) return false;
   tab.file = file;
   tab.saved = null;
   tab.sessionStored = true;
   if (meta.width && meta.width !== tab.frame.clientWidth && meta.state?.view) {
    viewer.gridResizeView(meta.state.view);
   }
   return true;
  }
  if (meta.sourceID) {
   try {
    const source = await pdfGridDesktop.refreshPDF(meta.sourceID);
    const file = new File([source.bytes], source.name, {type:'application/pdf'});
    file.pdfGridSourceID = source.sourceID;
    if (await openPDF(file)) { await keep(tab, file); return true; }
   } catch {}
  }
  if (tab.removed) return false;
  let record;
  try { record = await transaction('readonly', store => store.get(meta.id)); } catch {}
  if (tab.removed) return false;
  if (record?.handle) {
   try {
    const file = await record.handle.getFile();
    file.pdfGridHandle = record.handle;
    if (await openPDF(file)) { await keep(tab, file); return true; }
   } catch {}
  }
  if (!tab.removed && record?.file) {
   const file = new File([record.file], record.name, {type:'application/pdf'});
   file.pdfGridSourceID = meta.sourceID;
   if (await openPDF(file)) {
    if (meta.sourceID || record.handle) viewer.notice('원본 파일을 읽지 못해 마지막으로 저장된 PDF를 복원했습니다.');
    return true;
   }
  }
  if (!tab.removed) viewer.notice('이전 PDF를 불러오지 못했습니다. 탭을 다시 누르거나 원본을 열어 주세요.');
  return false;
 }
 function load(tab) {
  if (tab.removed) return tab.closed;
  if (tab.loading) return tab.loading;
  if (!tab.saved) return tab.mount();
  tab.reload.disabled = true;
  tab.reload.setAttribute('aria-busy', 'true');
  const opening = tab.mount().then(() => materialize(tab, tab.saved)).catch(() => {
   if (!tab.removed) tab.frame.contentWindow?.notice?.('이전 PDF를 불러오지 못했습니다.');
   return false;
  });
  tab.loading = Promise.race([opening,tab.closed]).finally(() => {
   tab.loading = null;
   if (!tab.removed) {
    tab.reload.disabled = false;
    tab.reload.removeAttribute('aria-busy');
    changed();
   }
  });
  return tab.loading;
 }
 function drop(id) {
  if (!id) return;
  const removing = transaction('readwrite', store => store.delete(id));
  pending.add(removing);
  removing.catch(() => {}).finally(() => pending.delete(removing));
 }
 function finishStartup() {
  loading = false;
  metadata();
  if (!restoredMetadata) return;
  // Closed placeholders keep their snapshots for undo during this run. Remove
  // snapshots that were left behind by an earlier run without reading files.
  const live = new Set([...adapter.tabs().map(tab => tab.sessionID), ...adapter.closedIds()]);
  void transaction('readwrite', store => {
   const keys = store.getAllKeys();
   keys.onsuccess = () => {
    for (const key of keys.result) if (!live.has(key)) store.delete(key);
   };
   return keys;
  }).catch(() => {});
 }
 window.addEventListener('pagehide',metadata);
 return {ready:Promise.resolve(),start,load,keep,changed,flush,drop,finishStartup};
})();
