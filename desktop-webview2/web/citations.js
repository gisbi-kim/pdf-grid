(function(root){
 'use strict';
 const pages=new WeakMap();
 const entryStart=text=>/^\s*(?:\[\d{1,4}\]|\d{1,4}[.)])\s*/.test(text);
 async function textPage(pdf,index){
  let cache=pages.get(pdf);if(!cache){cache=new Map();pages.set(pdf,cache)}
  if(!cache.has(index))cache.set(index,(async()=>{
   const page=await pdf.getPage(index+1),content=await page.getTextContent();
   return {width:page.view[2]-page.view[0],items:content.items.filter(it=>it.str?.trim()).map(it=>({text:it.str,x:it.transform[4],y:it.transform[5],height:it.height||Math.abs(it.transform[3])||10,width:it.width||0}))};
  })());
  return cache.get(index);
 }
 function linesOf(data,column){
  const items=data.items.filter(it=>column==null||(it.x<data.width/2?0:1)===column).sort((a,b)=>b.y-a.y||a.x-b.x),lines=[];
  for(const it of items){let line=lines.find(l=>Math.abs(l.y-it.y)<Math.max(2,Math.min(l.height,it.height)*.28));if(!line){line={x:it.x,y:it.y,height:it.height,items:[]};lines.push(line)}line.items.push(it);line.x=Math.min(line.x,it.x)}
  for(const line of lines){line.items.sort((a,b)=>a.x-b.x);line.text=line.items.map(it=>it.text).join(' ').replace(/\s+/g,' ').trim()}
  return lines.sort((a,b)=>b.y-a.y||a.x-b.x);
 }
 function paragraph(data,x,y,number){
  let column=Number.isFinite(x)?(x<data.width/2?0:1):null;
  if(column==null&&number){const candidate=data.items.find(it=>new RegExp('^\\s*\\['+number+'\\]').test(it.text));if(candidate)column=candidate.x<data.width/2?0:1}
  let lines=linesOf(data,column),start=-1;
  if(number)start=lines.findIndex(line=>new RegExp('^\\s*\\['+number+'\\](?:\\s|$)').test(line.text));
  if(start<0){let distance=Infinity;lines.forEach((line,i)=>{const d=Math.abs(line.y-y)+(line.y>y+5?20:0);if(d<distance){distance=d;start=i}})}
  if(start<0)return null;
  // A destination may point to the second line of a hanging reference.
  if(!entryStart(lines[start].text))for(let i=start-1;i>=Math.max(0,start-6);i--){if(entryStart(lines[i].text)){start=i;break}if(lines[i].y-lines[i+1].y>lines[i].height*2)break}
  const chosen=[],base=lines[start];
  for(let i=start;i<Math.min(lines.length,start+12);i++){
   const line=lines[i],previous=lines[i-1];
   if(i>start&&(entryStart(line.text)||previous.y-line.y>Math.max(base.height*1.85,22)||/^(References|Bibliography|참고문헌)\b/i.test(line.text)))break;
   if(i>start+1&&line.x<base.x+3&&previous.x>base.x+5&&!entryStart(base.text))break;
   chosen.push(line.text);
   if(chosen.join(' ').length>2200)break;
  }
  return chosen.join(' ').replace(/([a-z])- ([a-z])/g,'$1$2');
 }
 async function citation(pdf,data,ownerPage){
  if(!data.dest)return null;
  const named=typeof data.dest==='string'?data.dest:'',dest=named?await pdf.getDestination(named):data.dest;
  if(!Array.isArray(dest))return null;
  const index=Number.isInteger(dest[0])?dest[0]:await pdf.getPageIndex(dest[0]);
  if(!Number.isInteger(index)||index<0||index>=pdf.numPages)return null;
  const target=await textPage(pdf,index);
  const known=/(?:^|[.:/_-])(?:cite|bib)(?:[.:/_-]|$)/i.test(named)||/^(cite|bib)/i.test(named);
  let number=null;
  if(Array.isArray(data.rect)){
   const source=await textPage(pdf,ownerPage),[x1,y1,x2,y2]=data.rect;
   const text=source.items.filter(it=>it.x+it.width>=x1-2&&it.x<=x2+2&&it.y>=y1-4&&it.y<=y2+4&&it.width<=(x2-x1)*2+4).map(it=>it.text).join(' ');
   number=text.match(/\[\s*(\d{1,4})\s*\]/)?.[1]||null;
  }
  const type=dest[1]?.name,x=type==='XYZ'?dest[2]:null,y=type==='XYZ'?dest[3]:['FitH','FitBH'].includes(type)?dest[2]:Math.max(0,...target.items.map(it=>it.y));
  const text=paragraph(target,Number.isFinite(x)?x:null,Number.isFinite(y)?y:0,(known&&type==='XYZ'&&Number.isFinite(y))?null:number);
  const bibliography=target.items.some(it=>/^(references|bibliography|참고문헌)$/i.test(it.text.trim()));
  if(!known&&!(number&&text&&(bibliography||entryStart(text)&&/(?:19|20)\d{2}|doi|arxiv|proceedings|journal/i.test(text))))return null;
  return {page:index+1,key:number?'['+number+']':named.replace(/^(?:cite|bib)[.:_-]?/i,''),text:text||'이 PDF에서 참고문헌 텍스트를 읽을 수 없습니다.'};
 }
 function attach(link,pdf,data,ownerPage){
  let timer,sequence=0;
  let card=document.getElementById('citationCard');
  if(!card){card=document.createElement('aside');card.id='citationCard';card.className='citationCard';card.hidden=true;card.setAttribute('role','note');card.setAttribute('aria-label','인용 논문 정보');document.body.append(card);card.addEventListener('pointerleave',()=>{card.hidden=true});document.addEventListener('keydown',e=>{if(e.key==='Escape')card.hidden=true});window.addEventListener('scroll',event=>{if(!card.contains(event.target))card.hidden=true},true)}
  function hide(){clearTimeout(timer);++sequence;timer=setTimeout(()=>{if(!card.matches(':hover'))card.hidden=true},150)}
  function show(){clearTimeout(timer);const id=++sequence;timer=setTimeout(async()=>{
   try{
    const info=await citation(pdf,data,ownerPage);if(id!==sequence||!link.isConnected||!info)return;
    card.replaceChildren();const heading=document.createElement('h2'),text=document.createElement('p'),source=document.createElement('small');
    heading.textContent='인용 논문'+(info.key?' · '+info.key:'');text.textContent=info.text;source.textContent=`문서의 참고문헌 · ${info.page}쪽 · 링크를 클릭하면 이동`;
    card.append(heading,text,source);card.hidden=false;
    const rect=link.getBoundingClientRect();card.style.left=Math.max(12,Math.min(rect.left,innerWidth-card.offsetWidth-12))+'px';
    card.style.top=Math.max(8,rect.bottom+10+card.offsetHeight<innerHeight?rect.bottom+10:rect.top-card.offsetHeight-10)+'px';
   }catch{}
  },180)}
  link.addEventListener('mouseenter',show);link.addEventListener('mouseleave',hide);link.addEventListener('focus',show);link.addEventListener('blur',hide);link.addEventListener('click',()=>{clearTimeout(timer);++sequence;card.hidden=true});
 }
 root.PDFGridCitations={attach,citation,paragraph};
 if(typeof module==='object')module.exports=root.PDFGridCitations;
})(globalThis);
