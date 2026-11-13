const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const current=html.slice(html.indexOf('function rowScrollTolerance('),html.indexOf('// Viewport controls'));
const movement=html.slice(html.indexOf('function scrollGridTo('),html.indexOf("$('prev').onclick"));
const keyboard=html.slice(html.indexOf("document.addEventListener('keydown',e=>{if(e.defaultPrevented"),html.indexOf("document.addEventListener('keydown',e=>{if(e.defaultPrevented")+1000).split('\n')[0];
function fixture({pages=61,cols=2,scale=.91,cellH=841.89,height=620}={}){
 const elements=Object.fromEntries(['prev','next','page','total','rows','zoomLabel'].map(id=>[id,{}]));
 const max=Math.max(0,Math.ceil((Math.ceil(pages/cols)*(cellH+20)-20)*scale+64)-height);
 let top=0,handler;
 const stage={clientHeight:height,scrollHeight:max+height,scrollLeft:0,get scrollTop(){return top},set scrollTop(v){top=Math.min(max,Math.max(0,Math.round(v)))}};
 const c=vm.createContext({stage,doc:{numPages:pages},items:Array(pages).fill({}),cols,scale,fitScale:scale,cellH,GAP:20,PAD:32,$:id=>elements[id],scheduleRender(){},document:{addEventListener(type,fn){handler=fn}},fit(){},zoom(){}});
 vm.runInContext(current+movement+keyboard,c);vm.runInContext("controls()",c);
 const key=(key,props={})=>{let prevented=false;handler({key,target:{closest:()=>false},preventDefault(){prevented=true},...props});return prevented};
 return {c,stage,max,elements,key};
}
test('fractional row boundaries never send the next key to the same row',()=>{
 const f=fixture({scale:865.0511746629659/(841.89+20)});
 f.key('ArrowRight');assert.equal(vm.runInContext('currentPage()',f.c),3);
 const top=f.stage.scrollTop;f.key('ArrowRight');assert.ok(f.stage.scrollTop>top);assert.equal(vm.runInContext('currentPage()',f.c),5);
});
test('both directions make progress until the physical endpoint across zoom/column layouts',()=>{
 for(const cols of [1,2,3,7,10])for(const scale of [.0375,.173,.389,.91,1.333,3.17])for(const height of [410,680,1200]){
  const f=fixture({cols,scale,height});
  let count=0;
  while(!f.elements.next.disabled || count===0){const before=f.stage.scrollTop;const can=vm.runInContext('canMoveRows(1)',f.c);f.key('ArrowRight');if(can)assert.ok(f.stage.scrollTop>before,`Forward stalled: ${JSON.stringify({cols,scale,height,before})}`);else break;assert.ok(++count<500)}
  assert.ok(f.max-f.stage.scrollTop<=1);assert.equal(f.elements.next.disabled,true);
  count=0;while(vm.runInContext('canMoveRows(-1)',f.c)){const before=f.stage.scrollTop;f.key('ArrowLeft');assert.ok(f.stage.scrollTop<before);assert.ok(++count<500)}
  assert.ok(f.stage.scrollTop<=1);assert.equal(f.elements.prev.disabled,true);
 }
});
test('first row goes to the true top; last-row remainder can still be reached',()=>{
 const f=fixture({pages:3,cols:2,scale:2});
 vm.runInContext('go(1)',f.c);assert.equal(f.stage.scrollTop,0);
 vm.runInContext('go(3)',f.c);assert.equal(f.elements.next.disabled,false);
 f.key('ArrowRight');assert.equal(f.stage.scrollTop,f.max);assert.equal(f.elements.next.disabled,true);
 f.key('ArrowLeft');assert.ok(f.stage.scrollTop<f.max);
});
test('editing and modified arrows retain their native behavior',()=>{
 const f=fixture();vm.runInContext('controls()',f.c);
 for(const props of [{shiftKey:true},{ctrlKey:true},{metaKey:true},{altKey:true},{defaultPrevented:true},{target:{closest:()=>({})}}]){
  const top=f.stage.scrollTop;assert.equal(f.key('ArrowRight',props),false);assert.equal(f.stage.scrollTop,top);
 }
});
