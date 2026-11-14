const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const viewer=fs.existsSync(path.join(__dirname,'../../viewer'))?'../../viewer':'../..';
const History=require(path.join(__dirname,viewer,'history.js'));
const citations=require(path.join(__dirname,viewer,'citations.js'));
const point=(page,top=page*100)=>({page,view:{cols:2,scale:1,zoom:1,left:0,top}});
test('reading history returns to exact reading positions and truncates a forward branch',()=>{
 const history=new History();history.record(point(2,120),point(12,980));
 assert.equal(history.move(-1,point(12,1035)).view.top,120);
 assert.equal(history.move(1,point(2,155)).view.top,1035);
 history.move(-1,point(12,1060));history.record(point(2,155),point(8,600));
 assert.equal(history.entries.length,2);assert.equal(history.move(1,point(8)),null);
 const restored=new History(JSON.parse(JSON.stringify(history.export())));assert.deepEqual(restored.export(),history.export());
 assert.equal(restored.move(-1,point(8,612)).page,2);
});
test('history remains bounded and ignores malformed persisted coordinates',()=>{
 const h=new History();for(let n=1;n<140;n++)h.record(point(n),point(n+1));assert.equal(h.entries.length,100);
 const invalid=new History({entries:[{page:2,view:{scale:Infinity}},point(3)],index:50});assert.equal(invalid.entries.length,1);assert.equal(invalid.index,0);
});
const item=(str,x,y,width=180)=>({str,transform:[10,0,0,10,x,y],height:10,width});
const content=[item('References',40,770),item('[1] Jane Researcher and Alex Author.',40,720),item('A Study of Reliable Robot Mapping.',54,708),item('IEEE Robotics, 2025.',54,696),item('[2] Another Author. Unrelated Paper, 2020.',40,660),item('[9] Right Column Paper, 2024.',330,720)];
const pdf={numPages:3,async getDestination(name){return name==='cite.mapping'?[2,{name:'XYZ'},40,724,null]:[0,{name:'Fit'}]},async getPage(index){return {view:[0,0,600,842],async getTextContent(){return {items:index===3?content:[item('[1]',100,700,15)]}}}}};
test('citation hover extracts one reference from the correct column without adjacent entries',async()=>{
 const citation=await citations.citation(pdf,{dest:'cite.mapping',rect:[99,695,119,710]},0);
 assert.equal(citation.page,3);assert.match(citation.text,/Jane Researcher.*Reliable Robot Mapping.*2025/);
 assert.doesNotMatch(citation.text,/Unrelated|Right Column/);
 assert.equal(await citations.citation(pdf,{dest:'chapter'},0),null);
});
