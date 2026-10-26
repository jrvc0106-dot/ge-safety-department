import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pdfCanvasPageIsTrulyEmpty,renderPaginatedPdf} from '../src/pdf-export.js';

const pageSize={inner:{width:8,px:{height:1003}}};
const options={jsPDF:{unit:'in',format:'letter'},margin:[.25,.25,.3,.25],html2canvas:{useCORS:true}};
function scanningDocument(){
 return {createElement:()=>({
  width:0,height:0,
  getContext(){return {
   drawImage(canvas){this.source=canvas},
   getImageData(){
    const pixels=new Uint8ClampedArray(256*320*4).fill(255);
    if(this.source?.ink!==undefined){
     const i=(50*256+50)*4;
     pixels[i]=this.source.ink;
     pixels[i+1]=this.source.ink;
     pixels[i+2]=this.source.ink;
    }
    return {data:pixels};
   }
  }}
 })};
}

test('only truly white sheets count as empty; even faint logo/text evidence is protected',()=>{
 const doc=scanningDocument();
 assert.equal(pdfCanvasPageIsTrulyEmpty({width:1800,height:2000},{documentRef:doc}),true);
 assert.equal(pdfCanvasPageIsTrulyEmpty({width:1800,height:2000,ink:249},{documentRef:doc}),false);
 assert.equal(pdfCanvasPageIsTrulyEmpty({width:1800,height:2000,ink:40},{documentRef:doc}),false);
 assert.equal(pdfCanvasPageIsTrulyEmpty({width:0,height:2000},{documentRef:doc}),false);
 assert.equal(pdfCanvasPageIsTrulyEmpty({width:1800,height:2000},{documentRef:{createElement(){throw Error('iOS canvas failed')}}}),false);
});

test('middle and trailing blank sheets are omitted without deleting any real content',async()=>{
 const prior=globalThis.document,images=[],rendered=[];
 globalThis.document=scanningDocument();
 class Pdf{
  addPage(){images.push('NEW PAGE')}
  addImage(){images.push('EVIDENCE')}
  output(){return new Blob(['PDF'])}
 }
 try{
  const result=await renderPaginatedPdf({scrollHeight:4012},pageSize,options,async(_container,opts)=>{
   rendered.push(opts.y);
   return {width:1600,height:2089,ink:opts.y===1003||opts.y===3009?undefined:25,
    toDataURL:()=> 'data:image/jpeg;base64,AAA'};
  },Pdf);
  assert.ok(result.size);
  assert.deepEqual(rendered,[0,1003,2006,3009]);
  assert.deepEqual(images,['EVIDENCE','NEW PAGE','EVIDENCE']);
 }finally{globalThis.document=prior}
});

test('all-white final report is refused rather than archived as an empty PDF',async()=>{
 const prior=globalThis.document;
 globalThis.document=scanningDocument();
 class Pdf{addImage(){throw Error('blank sheet must never be added')};output(){return new Blob(['invalid'])}}
 try{
  await assert.rejects(renderPaginatedPdf({scrollHeight:1003},pageSize,options,
   async()=>({width:1600,height:2000,toDataURL:()=>''}),Pdf),/no visible page content/);
 }finally{globalThis.document=prior}
});
