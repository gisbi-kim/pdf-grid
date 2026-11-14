(function(root){
 'use strict';
 function clean(value){
  const v=value?.view;
  if(!v||!['cols','scale','left','top'].every(k=>Number.isFinite(v[k])))return null;
  return {page:Math.max(1,Math.round(Number(value.page)||1)),view:{cols:Math.max(1,Math.min(10,Math.round(v.cols))),scale:Math.max(.01,Math.min(1000,v.scale)),zoom:Number(v.zoom)||1,left:Math.max(0,Math.min(1e9,v.left)),top:Math.max(0,Math.min(1e9,v.top))}};
 }
 class ReadingHistory{
  constructor(saved){this.entries=[];this.index=-1;this.restore(saved)}
  restore(saved){
   if(!Array.isArray(saved?.entries))return;
   this.entries=saved.entries.slice(-100).map(clean).filter(Boolean);
   this.index=Math.max(0,Math.min(this.entries.length-1,Number(saved.index)||0));
   if(!this.entries.length)this.index=-1;
  }
  update(position){const p=clean(position);if(!p)return;if(this.index<0){this.entries=[p];this.index=0}else this.entries[this.index]=p}
  record(from,to){
   const a=clean(from),b=clean(to);if(!a||!b)return;
   this.update(a);
   if(a.page===b.page&&Math.abs(a.view.top-b.view.top)<1&&Math.abs(a.view.left-b.view.left)<1&&Math.abs(a.view.scale-b.view.scale)<.001)return;
   this.entries=this.entries.slice(0,this.index+1);this.entries.push(b);
   if(this.entries.length>100)this.entries.shift();this.index=this.entries.length-1;
  }
  move(delta,current){this.update(current);const next=this.index+delta;if(next<0||next>=this.entries.length)return null;this.index=next;return this.entries[next]}
  export(){return {entries:this.entries.map(p=>clean(p)),index:this.index}}
 }
 root.PDFGridReadingHistory=ReadingHistory;
 if(typeof module==='object')module.exports=ReadingHistory;
})(globalThis);
