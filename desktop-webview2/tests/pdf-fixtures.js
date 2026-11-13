(function(root){
 async function createPDFGridFixture(lib,count=24){
  const {PDFDocument,PDFName,PDFString,degrees}=lib,pdf=await PDFDocument.create(),pages=[];
  for(let i=0;i<count;i++){const p=pdf.addPage([595.28,841.89]);p.drawText('Page '+(i+1),{x:50,y:790,size:24});pages.push(p)}pages[3].setRotation(degrees(90));const c=pdf.context;
  function link(page,rect,data){const ref=c.register(c.obj({Type:'Annot',Subtype:'Link',Rect:rect,Border:[0,0,0],...data}));const list=page.node.Annots();if(list)list.push(ref);else page.node.set(PDFName.of('Annots'),c.obj([ref]))}
  link(pages[0],[50,700,260,730],{Dest:[pages[9].ref,'Fit']});link(pages[0],[50,650,260,680],{Dest:PDFString.of('chapter')});link(pages[0],[50,600,260,630],{A:{S:'URI',URI:PDFString.of('https://example.com/pdf-link')}});link(pages[0],[50,550,260,580],{A:{S:'URI',URI:PDFString.of('javascript:alert(1)')}});link(pages[3],[50,700,260,730],{Dest:[pages[0].ref,'Fit']});
  pdf.catalog.set(PDFName.of('Names'),c.obj({Dests:{Names:[PDFString.of('chapter'),[pages[3].ref,'XYZ',50,750,null]]}}));const outline=c.obj({Type:'Outlines',Count:1}),outlineRef=c.register(outline),chapter=c.register(c.obj({Title:PDFString.of('Chapter Four'),Parent:outlineRef,Dest:PDFString.of('chapter')}));outline.set(PDFName.of('First'),chapter);outline.set(PDFName.of('Last'),chapter);pdf.catalog.set(PDFName.of('Outlines'),outlineRef);
  return pdf.save();
 }
 if(typeof module==='object')module.exports=createPDFGridFixture;else root.createPDFGridFixture=createPDFGridFixture;
})(globalThis);
