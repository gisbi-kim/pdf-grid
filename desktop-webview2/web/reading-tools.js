'use strict';
window.PDFGridReadingTools={create(adapter){
 let history=new PDFGridReadingHistory(),replaying=false;
 const bar=document.createElement('nav');bar.className='readingNav';bar.setAttribute('aria-label','PDF 이동 이력');
 const back=document.createElement('button'),forward=document.createElement('button'),current=document.createElement('span');
 back.id='historyBack';forward.id='historyForward';current.id='historyCurrent';
 back.type=forward.type='button';back.title='이전 위치 ([ · 마우스 뒤로)';forward.title='다음 위치 (] · 마우스 앞으로)';
 bar.append(back,current,forward);document.querySelector('.footerHint')?.remove();document.querySelector('footer').append(bar);
 const capture=()=>({view:adapter.capture(),page:adapter.page()});
 function label(p){return p?`${p.page}쪽`:'없음'}
 function paint(){
  back.disabled=history.index<=0;forward.disabled=history.index<0||history.index>=history.entries.length-1;
  back.textContent='← 이전: '+label(history.entries[history.index-1]);forward.textContent='다음: '+label(history.entries[history.index+1])+' →';
  current.textContent=adapter.ready()?'현재 '+adapter.page()+'쪽':'이동 이력';
  back.setAttribute('aria-label',back.textContent);forward.setAttribute('aria-label',forward.textContent);
 }
 function changed(){paint();adapter.changed?.()}
 function move(delta){
  if(!adapter.ready())return false;
  const target=history.move(delta,capture());if(!target){paint();return false}
  replaying=true;adapter.restore(target.view,target.page);replaying=false;changed();return true;
 }
 back.onclick=()=>move(-1);forward.onclick=()=>move(1);
 function editing(target){return target?.closest?.('input,textarea,select,[contenteditable]')}
 document.addEventListener('keydown',event=>{
  const hardware=event.key==='BrowserBack'||event.key==='BrowserForward';
  if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||(!hardware&&editing(event.target)))return;
  const direction=(event.key==='['||event.key==='BrowserBack')?-1:(event.key===']'||event.key==='BrowserForward')?1:0;if(!direction)return;
  event.preventDefault();event.stopPropagation();move(direction);
 },true);
 for(const type of ['mousedown','mouseup','auxclick'])document.addEventListener(type,event=>{
  if(event.button!==3&&event.button!==4)return;
  event.preventDefault();event.stopPropagation();if(type==='mousedown')move(event.button===3?-1:1);
 },true);
 window.pdfGridHistoryMove=move;paint();
 return {
  before:()=>adapter.ready()?capture():null,
  commit(from,page){if(from){const to=capture();if(page)to.page=page;history.record(from,to);changed()}},
  reset(saved){history=new PDFGridReadingHistory(saved);if(history.index<0&&adapter.ready())history.update(capture());changed()},
  viewport(){if(adapter.ready()&&!replaying)history.update(capture());paint();adapter.changed?.()},
  export:()=>history.export(),move
 };
}};
