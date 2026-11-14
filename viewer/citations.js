(function(root){
 'use strict';
 const pages=new WeakMap(),annotationPages=new WeakMap();
 const entryStart=text=>/^\s*(?:\[\d{1,4}\]|\d{1,3}[.)])\s*/.test(text);
 function withoutLineNumbers(items){
  // Review manuscripts have a separate, aligned sequence of marginal line numbers.
  // Requiring a run of consecutive values avoids removing years or reference labels.
  const groups=new Map(),omit=new Set();
  for(const it of items)if(/^\d{2,4}$/.test(it.text.trim())){const key=Math.round(it.x/3);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(it)}
  for(const group of groups.values()){
   group.sort((a,b)=>b.y-a.y);let consecutive=0;
   for(let i=1;i<group.length;i++){const step=Number(group[i].text)-Number(group[i-1].text);if(step>0&&step<=3)consecutive++}
   if(group.length>=6&&consecutive>=group.length*.7)for(const it of group)omit.add(it);
  }
  return items.filter(it=>!omit.has(it));
 }
 async function textPage(pdf,index){
  let cache=pages.get(pdf);if(!cache){cache=new Map();pages.set(pdf,cache)}
  if(!cache.has(index))cache.set(index,(async()=>{
   const page=await pdf.getPage(index+1),content=await page.getTextContent();
   return {width:page.view[2]-page.view[0],items:withoutLineNumbers(content.items.filter(it=>it.str?.trim()).map(it=>({text:it.str,x:it.transform[4],y:it.transform[5],height:it.height||Math.abs(it.transform[3])||10,width:it.width||0})))};
  })());
  return cache.get(index);
 }
 async function annotations(pdf,index){
  let cache=annotationPages.get(pdf);if(!cache){cache=new Map();annotationPages.set(pdf,cache)}
  if(!cache.has(index))cache.set(index,(async()=>{const page=await pdf.getPage(index+1);return page.getAnnotations?await page.getAnnotations({intent:'display'}):[]})());
  return cache.get(index);
 }
 function linesOf(data,column){
  const items=withoutLineNumbers(data.items).filter(it=>column==null||(it.x<data.width/2?0:1)===column).sort((a,b)=>b.y-a.y||a.x-b.x),lines=[];
  for(const it of items){let line=lines.find(l=>Math.abs(l.y-it.y)<Math.max(2,Math.min(l.height,it.height)*.28));if(!line){line={x:it.x,y:it.y,height:it.height,items:[]};lines.push(line)}line.items.push(it);line.x=Math.min(line.x,it.x)}
  for(const line of lines){
   line.items=line.items.map(it=>({...it})).sort((a,b)=>a.x-b.x);
   for(const mark of line.items)if(mark.text==='¨'){const word=line.items.find(it=>it!==mark&&/^[a-z]/i.test(it.text)&&Math.abs(it.x-mark.x)<mark.height*.5);if(word){word.text=(word.text[0]+'\u0308').normalize('NFC')+word.text.slice(1);mark.text=''}}
   let previous=null;line.text='';for(const it of line.items){if(!it.text)continue;line.text+=(previous&&it.x-previous.x-previous.width>it.height*.12?' ':'')+it.text;previous=it}line.text=line.text.replace(/\s+/g,' ').trim();
  }
  return lines.sort((a,b)=>b.y-a.y||a.x-b.x);
 }
 function reference(data,x,y,number){
  let column=Number.isFinite(x)?(x<data.width/2?0:1):null;
  if(column==null&&number){const candidate=data.items.find(it=>new RegExp('^\\s*\\['+number+'\\]').test(it.text));if(candidate)column=candidate.x<data.width/2?0:1}
  const lines=linesOf(data,column);let start=-1;
  if(number)start=lines.findIndex(line=>new RegExp('^\\s*\\['+number+'\\](?:\\s|$)').test(line.text));
  // Hyperref destinations sit at the TOP of the first line, often just below the
  // previous entry's last baseline. Prefer a nearby new entry below that point.
  if(start<0)start=lines.findIndex(line=>entryStart(line.text)&&line.y<=y+1&&y-line.y<=line.height*1.7);
  if(start<0){let distance=Infinity;lines.forEach((line,i)=>{const d=Math.abs(line.y-y)+(line.y>y+1?line.height*1.5:0);if(d<distance){distance=d;start=i}})}
  if(start<0)return null;
  if(!entryStart(lines[start].text))for(let i=start-1;i>=Math.max(0,start-10);i--){if(entryStart(lines[i].text)){start=i;break}if(lines[i].y-lines[i+1].y>lines[i].height*2)break}
  const chosen=[],base=lines[start];
  for(let i=start;i<Math.min(lines.length,start+24);i++){
   const line=lines[i],previous=lines[i-1];
   if(i>start&&(entryStart(line.text)||previous.y-line.y>Math.max(base.height*1.85,22)||/^(References|Bibliography|참고문헌)\b/i.test(line.text)))break;
   if(i>start+1&&line.x<base.x+3&&previous.x>base.x+5&&!entryStart(base.text))break;
   chosen.push(line);if(chosen.map(l=>l.text).join(' ').length>3000)break;
  }
  return {text:chosen.map(l=>l.text).join(' ').replace(/\b(open|language|vision|cross|scene|real|zero)- ([a-z])/gi,'$1-$2').replace(/([a-z])- ([a-z])/g,'$1$2'),lines:chosen,column};
 }
 function paragraph(data,x,y,number){return reference(data,x,y,number)?.text||null}
 function paperLinks(text,urls=[]){
  const links=[],seen=new Set(),clean=value=>value.replace(/[.,;:]+$/,'').replace(/\)+$/,tail=>{const opens=(value.match(/\(/g)||[]).length,closes=(value.match(/\)/g)||[]).length;return tail.slice(0,Math.max(0,tail.length-Math.max(0,closes-opens)))});
  function add(type,id){id=clean(id);const url=type==='doi'?'https://doi.org/'+id:'https://arxiv.org/abs/'+id;if(!seen.has(url.toLowerCase())){seen.add(url.toLowerCase());links.push({type,id,url,label:type==='doi'?'DOI · 논문 페이지':'arXiv · 논문 페이지'})}}
  for(const value of [text,...urls]){
   // PDF text often inserts spaces around a wrapped DOI slash or after arXiv:.
   const compact=String(value).replace(/(10\.\d{4,9})\s*\/\s*/g,'$1/').replace(/(arxiv\s*:\s*)/ig,'arXiv:');
   for(const m of compact.matchAll(/\b10\.\d{4,9}\/[-\w.():;\/+%]+/gi))add('doi',m[0]);
   for(const m of compact.matchAll(/(?:arxiv\s*:\s*|https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\/)(\d{4}\.\d{4,5}(?:v\d+)?|[a-z][\w.-]*(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)(?:\.pdf)?/gi))add('arxiv',m[1]);
  }
  return links;
 }
 function metadata(text){
  const body=text.replace(/^\s*(?:\[\d+\]|\d+[.)])\s*/,'').replace(/\s+\d{1,3}(?:\s*,\s*\d{1,3})*\s*$/,'').trim();
  // Keep the original text available: bibliographic formats vary and extraction
  // must never manufacture an abstract, citation count or paper metadata.
  const boundary=/\.\s+(?=[A-Z0-9“"‘])/g;let match,authorEnd=-1;
  while((match=boundary.exec(body))){const before=body.slice(0,match.index);if(before.length<4)continue;if(/\b[A-Z]$/.test(before)&&!/et al$/.test(before))continue;authorEnd=match.index;break}
  if(authorEnd<0)return {title:body,authors:'',venue:'',raw:body};
  const authors=body.slice(0,authorEnd),rest=body.slice(authorEnd+2);let titleEnd=-1;
  for(const m of rest.matchAll(/\.\s+(?=(?:In\b|Proceedings\b|IEEE\b|ACM\b|arXiv\b|Journal\b|International\b|Transactions\b|(?:19|20)\d{2}\b))/g)){titleEnd=m.index;break}
  if(titleEnd<0){const m=/\.\s+/.exec(rest);if(m)titleEnd=m.index}
  return {title:titleEnd>=0?rest.slice(0,titleEnd):rest,authors,venue:titleEnd>=0?rest.slice(titleEnd+2):'',raw:body};
 }
 async function citation(pdf,data,ownerPage){
  if(!data.dest)return null;
  const named=typeof data.dest==='string'?data.dest:'',dest=named?await pdf.getDestination(named):data.dest;
  if(!Array.isArray(dest))return null;
  const index=Number.isInteger(dest[0])?dest[0]:await pdf.getPageIndex(dest[0]);
  if(!Number.isInteger(index)||index<0||index>=pdf.numPages)return null;
  const target=await textPage(pdf,index),known=/^(cite|bib)|[.:/_-](?:cite|bib)[.:/_-]/i.test(named);
  let number=null;
  if(Array.isArray(data.rect)){
   const source=await textPage(pdf,ownerPage),[x1,y1,x2,y2]=data.rect;
   const text=source.items.filter(it=>it.x+it.width>=x1-2&&it.x<=x2+2&&it.y>=y1-4&&it.y<=y2+4&&it.width<=(x2-x1)*2+4).map(it=>it.text).join(' ');
   number=text.match(/^\s*\[?\s*(\d{1,4})\s*\]?\s*$/)?.[1]||null;
  }
  const type=dest[1]?.name,x=type==='XYZ'?dest[2]:null,y=type==='XYZ'?dest[3]:['FitH','FitBH'].includes(type)?dest[2]:Math.max(0,...target.items.map(it=>it.y));
  const entry=reference(target,Number.isFinite(x)?x:null,Number.isFinite(y)?y:0,number),text=entry?.text;
  const bibliography=target.items.some(it=>/^(references|bibliography|참고문헌)$/i.test(it.text.trim()));
  if(!known&&!(number&&text&&(bibliography||entryStart(text)&&/(?:19|20)\d{2}|doi|arxiv|proceedings|journal/i.test(text))))return null;
  const urls=[];
  if(entry?.lines.length)for(const a of await annotations(pdf,index)){
   if(!a.url||!a.rect)continue;
   const [left,bottom,right,top]=a.rect;
   if(entry.lines.some(line=>top>=line.y-3&&bottom<=line.y+line.height+3&&right>=line.x&&left<=Math.max(...line.items.map(it=>it.x+it.width))+3))urls.push(a.url);
  }
  return {page:index+1,key:text?.match(/^\s*(\[\d+\])/ )?.[1]||(number?'['+number+']':named.replace(/^(?:cite|bib)[.:_-]?/i,'')),text:text||'이 PDF에서 참고문헌 텍스트를 읽을 수 없습니다.',...metadata(text||'참고문헌 미리보기'),links:paperLinks(text||'',urls),destination:data.dest};
 }
 async function citationGroup(pdf,data,ownerPage){
  let group=[data];
  if(data.rect){
   const all=(await annotations(pdf,ownerPage)).filter(a=>a.dest&&a.rect&&Math.abs(a.rect[1]-data.rect[1])<3&&Math.abs(a.rect[3]-data.rect[3])<3).sort((a,b)=>a.rect[0]-b.rect[0]);
   let left=data.rect[0],right=data.rect[2],changed=true;
   while(changed){changed=false;for(const a of all)if(a.rect[0]<=right+9&&a.rect[2]>=left-9&&(a.rect[0]<left||a.rect[2]>right)){left=Math.min(left,a.rect[0]);right=Math.max(right,a.rect[2]);changed=true}}
   group=all.filter(a=>a.rect[0]>=left&&a.rect[2]<=right);if(!group.length)group=[data];
  }
  const seen=new Set(),result=[];
  for(const a of group){const key=JSON.stringify(a.dest);if(seen.has(key))continue;seen.add(key);try{const info=await citation(pdf,a,ownerPage);if(info)result.push(info)}catch{}}
  return result;
 }
 let popup=null;
 function popupState(){
  if(popup)return popup;
  const card=document.createElement('aside');card.id='citationCard';card.className='citationCard';card.hidden=true;card.setAttribute('role','dialog');card.setAttribute('aria-label','인용 논문 정보');document.body.append(card);
  const state=popup={card,sequence:0,showTimer:null,hideTimer:null,link:null,infos:[],index:0};
  state.hide=()=>{clearTimeout(state.showTimer);clearTimeout(state.hideTimer);++state.sequence;card.hidden=true;if(state.link)state.link.setAttribute('aria-expanded','false')};
  state.deferHide=()=>{clearTimeout(state.hideTimer);state.hideTimer=setTimeout(()=>{if(!card.matches(':hover')&&!card.contains(document.activeElement)&&!state.link?.matches(':hover')&&document.activeElement!==state.link)state.hide()},350)};
  card.addEventListener('pointerenter',()=>clearTimeout(state.hideTimer));card.addEventListener('pointerleave',state.deferHide);card.addEventListener('focusout',state.deferHide);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden){const focus=card.contains(document.activeElement);if(focus)state.link?.focus();state.hide()}});
  document.addEventListener('pointerdown',e=>{if(!card.contains(e.target)&&!state.link?.contains(e.target))state.hide()});
  window.addEventListener('scroll',e=>{if(!card.contains(e.target))state.hide()},true);window.addEventListener('resize',state.hide);
  return state;
 }
 function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node}
 function render(state){
  const {card,infos,index,link}=state,info=infos[index];card.replaceChildren();
  const header=element('div','citationHeader'),keys=element('div','citationKeys'),navigation=element('div','citationControls');
  infos.forEach((entry,i)=>{const b=element('button',i===index?'active':'',entry.key);b.type='button';b.setAttribute('aria-label',entry.key+' 참고문헌');b.setAttribute('aria-pressed',String(i===index));b.onclick=()=>{state.index=i;render(state)};keys.append(b)});
  navigation.append(element('span','citationCount',`${index+1} / ${infos.length}`));
  for(const [label,offset,icon] of [['이전 인용',-1,'‹'],['다음 인용',1,'›']]){const b=element('button','citationArrow',icon);b.type='button';b.setAttribute('aria-label',label);b.disabled=index+offset<0||index+offset>=infos.length;b.onclick=()=>{state.index+=offset;render(state)};navigation.append(b)}
  const close=element('button','citationClose','×');close.type='button';close.setAttribute('aria-label','미리보기 닫기');close.onclick=()=>{const focused=card.contains(document.activeElement);if(focused)link.focus();state.hide()};navigation.append(close);header.append(keys,navigation);
  const body=element('div','citationBody'),title=element('h2','citationTitle'),primary=info.links[0];
  function external(a,url){a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.addEventListener('click',e=>{e.stopPropagation();if(typeof root.openPDFExternal==='function'){e.preventDefault();Promise.resolve(root.openPDFExternal(url)).catch(()=>{message.textContent='논문 페이지를 열지 못했습니다.'})}});return a}
  const titleNode=primary?external(element('a','',info.title),primary.url):element('span','',info.title);title.append(titleNode);body.append(title);
  if(info.authors)body.append(element('p','citationAuthors',info.authors));if(info.venue)body.append(element('p','citationVenue',info.venue));
  const details=element('details','citationDetails'),summary=element('summary','','참고문헌 원문');details.append(summary,element('p','',info.text));body.append(details);details.addEventListener('toggle',()=>position(state));
  const message=element('p','citationSource',`문서의 참고문헌 · ${info.page}쪽`),actions=element('div','citationActions');
  for(const paper of info.links)actions.append(external(element('a','citationPaper '+paper.type,paper.label+' ↗'),paper.url));
  const referenceButton=element('button','citationReference','참조에서 보기');referenceButton.type='button';referenceButton.onclick=()=>{state.hide();if(typeof root.followPDFDestination==='function')root.followPDFDestination(info.destination,state.pdf,state.ownerPage);else link.pdfGridActivate?.()};actions.append(referenceButton);body.append(actions,message);card.append(header,body);card.hidden=false;
  position(state);
 }
 function position(state){
  const {card,link}=state;if(card.hidden||!link)return;
  const rect=link.getBoundingClientRect();card.style.left=Math.max(12,Math.min(rect.left,innerWidth-card.offsetWidth-12))+'px';
  card.style.top=Math.max(8,rect.bottom+8+card.offsetHeight<innerHeight?rect.bottom+8:rect.top-card.offsetHeight-8)+'px';
 }
 function attach(link,pdf,data,ownerPage){
  const state=popupState();link.setAttribute('aria-haspopup','dialog');link.setAttribute('aria-controls','citationCard');link.setAttribute('aria-expanded','false');
  function show(){clearTimeout(state.showTimer);clearTimeout(state.hideTimer);const id=++state.sequence;state.showTimer=setTimeout(async()=>{
   try{const infos=await citationGroup(pdf,data,ownerPage);if(id!==state.sequence||!link.isConnected||!infos.length)return;if(state.link)state.link.setAttribute('aria-expanded','false');Object.assign(state,{infos,pdf,ownerPage,link,index:Math.max(0,infos.findIndex(info=>JSON.stringify(info.destination)===JSON.stringify(data.dest)))});link.setAttribute('aria-expanded','true');render(state)}catch{}
  },180)}
  link.addEventListener('mouseenter',show);link.addEventListener('mouseleave',()=>{clearTimeout(state.showTimer);++state.sequence;state.deferHide()});link.addEventListener('focus',show);link.addEventListener('blur',state.deferHide);link.addEventListener('click',state.hide);
 }
 root.PDFGridCitations={attach,citation,citationGroup,paragraph,paperLinks,metadata,withoutLineNumbers};
 if(typeof module==='object')module.exports=root.PDFGridCitations;
})(globalThis);
