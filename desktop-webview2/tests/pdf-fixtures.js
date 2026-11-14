(function(root){
 async function createPDFGridFixture(lib,count=24){
  const {PDFDocument,PDFName,PDFString,degrees}=lib,pdf=await PDFDocument.create(),pages=[];
  for(let i=0;i<count;i++){const p=pdf.addPage([595.28,841.89]);p.drawText('Page '+(i+1),{x:50,y:790,size:24});pages.push(p)}pages[3].setRotation(degrees(90));const c=pdf.context;
  function link(page,rect,data){const ref=c.register(c.obj({Type:'Annot',Subtype:'Link',Rect:rect,Border:[0,0,0],...data}));const list=page.node.Annots();if(list)list.push(ref);else page.node.set(PDFName.of('Annots'),c.obj([ref]))}
  link(pages[0],[50,700,260,730],{Dest:[pages[9].ref,'Fit']});link(pages[0],[50,650,260,680],{Dest:PDFString.of('chapter')});link(pages[0],[50,600,260,630],{A:{S:'URI',URI:PDFString.of('https://example.com/pdf-link')}});link(pages[0],[50,550,260,580],{A:{S:'URI',URI:PDFString.of('javascript:alert(1)')}});link(pages[3],[50,700,260,730],{Dest:[pages[0].ref,'Fit']});
  const bibliography=pages[pages.length-1];bibliography.drawText('References',{x:50,y:750,size:18});
  bibliography.drawText('[1] Jane Researcher and Alex Author.',{x:50,y:700,size:11});bibliography.drawText('A Study of Reliable Robot Mapping.',{x:64,y:685,size:11});bibliography.drawText('IEEE Robotics, 2025.',{x:64,y:670,size:11});bibliography.drawText('doi:10.1000/robot.mapping',{x:64,y:655,size:11});bibliography.drawText('[2] Another Author. An Unrelated Paper, 2020.',{x:50,y:625,size:11});bibliography.drawText('arXiv:2401.12345.',{x:64,y:610,size:11});
  pages[1].drawText('Related work',{x:50,y:700,size:14});pages[1].drawText('[1]',{x:150,y:700,size:14});pages[1].drawText('[2]',{x:173,y:700,size:14});link(pages[1],[148,692,169,719],{Dest:PDFString.of('cite.mapping')});link(pages[1],[171,692,192,719],{Dest:PDFString.of('cite.other')});
  pdf.catalog.set(PDFName.of('Names'),c.obj({Dests:{Names:[PDFString.of('chapter'),[pages[3].ref,'XYZ',50,750,null],PDFString.of('cite.mapping'),[bibliography.ref,'XYZ',50,705,null],PDFString.of('cite.other'),[bibliography.ref,'XYZ',50,630,null]]}}));const outline=c.obj({Type:'Outlines',Count:1}),outlineRef=c.register(outline),chapter=c.register(c.obj({Title:PDFString.of('Chapter Four'),Parent:outlineRef,Dest:PDFString.of('chapter')}));outline.set(PDFName.of('First'),chapter);outline.set(PDFName.of('Last'),chapter);pdf.catalog.set(PDFName.of('Outlines'),outlineRef);
  return pdf.save();
 }
 if(typeof module==='object')module.exports=createPDFGridFixture;else root.createPDFGridFixture=createPDFGridFixture;
})(globalThis);
