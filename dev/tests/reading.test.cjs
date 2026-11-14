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
test('review line numbers and the preceding baseline do not contaminate a reference',()=>{
 const items=[];
 const rows=['[29] Previous Author. Previous paper.','2026, 2026. 1','[30] Ada Researcher and Alex Author.','Hierarchical scene graphs for robot navigation.','In Robotics: Science and Systems, 2024. 1, 2','[31] Next Author. Other paper, 2023.','Next entry continuation.'];
 rows.forEach((text,i)=>{items.push({text,x:i===1||i===3||i===4||i===6?78:58,y:202-i*11,height:9,width:215});items.push({text:String(700+i),x:24,y:202-i*11,height:8,width:13})});
 const text=citations.paragraph({width:612,items},58,180.5);
 assert.match(text,/^\[30\] Ada/);assert.doesNotMatch(text,/700|701|702|Previous|Next/);
 assert.deepEqual(citations.metadata(text),{title:'Hierarchical scene graphs for robot navigation',authors:'Ada Researcher and Alex Author',venue:'In Robotics: Science and Systems, 2024.',raw:'Ada Researcher and Alex Author. Hierarchical scene graphs for robot navigation. In Robotics: Science and Systems, 2024.'});
});
test('paper links normalize DOI and modern/legacy arXiv identifiers without accepting active URLs',()=>{
 const links=citations.paperLinks('doi: 10.1109 / ICRA.2025.1234567. arXiv: 2305.18323v2; arXiv:hep-th/9901001.', ['https://arxiv.org/pdf/2305.18323v2.pdf','https://doi.org/10.1109/ICRA.2025.1234567','javascript:alert(1)']);
 assert.deepEqual(links.map(l=>l.url),['https://doi.org/10.1109/ICRA.2025.1234567','https://arxiv.org/abs/2305.18323v2','https://arxiv.org/abs/hep-th/9901001']);
 assert.equal(citations.paperLinks('No identifier. javascript:alert(1)').length,0);
 assert.equal(citations.paperLinks('doi:10.1000/example(foo).')[0].url,'https://doi.org/10.1000/example(foo)');
});
test('bibliography URL annotations are scoped to the selected entry and nearby citations can be paged',async()=>{
 const targetItems=[item('[1] Ada Author. A Mapping Study.',40,720),item('IEEE Robotics, 2025.',54,708),item('[2] Ben Author. A Different Study.',40,680),item('arXiv:2401.12345, 2024.',54,668)];
 const refs=[{dest:'cite.one',rect:[100,695,115,710]},{dest:'cite.two',rect:[119,695,134,710]}];
 const fake={numPages:2,async getDestination(name){return [1,{name:'XYZ'},40,name==='cite.one'?729:689,null]},async getPage(n){return {view:[0,0,600,842],async getTextContent(){return {items:n===1?[item('1',100,700,10),item('2',119,700,10)]:targetItems}},async getAnnotations(){return n===1?refs:[{url:'https://doi.org/10.1000/mapping',rect:[54,705,150,718]},{url:'https://doi.org/10.1000/other',rect:[54,665,150,678]}]}}}};
 const group=await citations.citationGroup(fake,refs[0],0);
 assert.equal(group.length,2);assert.equal(group[0].title,'A Mapping Study');assert.equal(group[0].links.length,1);assert.equal(group[0].links[0].url,'https://doi.org/10.1000/mapping');assert.equal(group[1].links.length,2);assert.doesNotMatch(group[0].text,/Different/);
});
