const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const zoom=html.slice(html.indexOf('function zoom('),html.indexOf('function nearby('));
const gestures=html.slice(html.indexOf('// Touch gestures:'),html.indexOf('// End touch gestures.'));
function fixture(){
  const listeners={},captures=new Set();
  const stage={clientWidth:400,clientHeight:600,scrollLeft:500,scrollTop:400,
    classList:{toggle(){}},focus(){},getBoundingClientRect:()=>({left:20,top:100}),
    addEventListener(type,fn){(listeners[type]??=[]).push(fn)},
    setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
  const context=vm.createContext({stage,Date,doc:{},scale:1,fitScale:1,cols:2,cellW:612,PAD:32,GAP:20,searchMatches:[{}],pendingSearchCenter:{},
    minimumGridScale:()=>.1,position(){},scheduleRender(){},requestAnimationFrame(){throw Error('Pinch must not recenter search')},centerSearchMatch(){},window:{addEventListener(){}}});
  vm.runInContext(zoom+gestures,context);
  function emit(type,id,x=0,y=0){const e={pointerType:'touch',pointerId:id,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){this.stopped=true}};for(const fn of listeners[type]||[])fn(e);return e}
  return {context,stage,captures,emit};
}
function close(a,b){assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`)}
test('pinch follows both distance and moving midpoint, including a scrolled viewport',()=>{
  const {context:c,stage:s,emit}=fixture();
  emit('pointerdown',1,120,250);emit('pointerdown',2,220,250);
  const worldX=(s.scrollLeft+150-32)/c.scale,worldY=(s.scrollTop+150-32)/c.scale;
  emit('pointermove',1,70,250);
  close(c.scale,1.5);close(worldX*c.scale+32-s.scrollLeft,125);close(worldY*c.scale+32-s.scrollTop,150);
  assert.equal(c.pendingSearchCenter,null);
  emit('pointermove',1,120,250);close(c.scale,1);close(s.scrollLeft,500);close(s.scrollTop,400);
});
test('lifting either finger continues panning without jumping; cancellation releases capture',()=>{
  for(const lifted of [1,2]){
    const {context:c,stage:s,captures,emit}=fixture();
    emit('pointerdown',1,120,250);emit('pointerdown',2,220,250);emit('pointermove',1,70,250);
    emit('pointerup',lifted);const left=s.scrollLeft,top=s.scrollTop,remaining=lifted===1?2:1;
    emit('pointermove',remaining,remaining===2?230:80,270);
    close(s.scrollLeft,left-10);close(s.scrollTop,top-20);close(c.scale,1.5);
    emit('pointercancel',remaining);assert.equal(captures.size,0);
    emit('pointermove',remaining,900,900);close(s.scrollLeft,left-10);
    assert.equal(emit('click',remaining).stopped,true);
  }
});
test('zoom bounds, coincident fingers, and a third finger remain finite',()=>{
  const {context:c,emit}=fixture();
  emit('pointerdown',1,120,250);emit('pointerdown',2,120,250);emit('pointermove',2,220,250);
  emit('pointermove',2,100000,250);assert.equal(c.scale,16);
  emit('pointermove',2,120.01,250);assert.equal(c.scale,.1);
  emit('pointerdown',3,400,300);emit('pointerup',1);emit('pointermove',3,450,300);
  assert.ok(Number.isFinite(c.scale));
});
