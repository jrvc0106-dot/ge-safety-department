import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderQuickOrientationPdf} from '../src/pdf-export.js';
test('quick orientation fits tall content onto exactly one sheet without changing proportions',async()=>{
 const images=[];let pages=1;
 class Pdf{addPage(){pages++}addImage(...args){images.push(args)}output(){return new Blob(['pdf'])}}
 const report={querySelectorAll:()=>[],getBoundingClientRect:()=>({height:1100})};
 const container={querySelector:()=>report,ownerDocument:{createElement:()=>({})},append:()=>{},style:{}};
 const canvas={width:2016,height:2200,toDataURL:type=>{assert.equal(type,'image/png');return 'png'}};
 const blob=await renderQuickOrientationPdf(container,{inner:{width:10.5,height:7.95}},{jsPDF:{orientation:'landscape'},margin:[.25,.25],html2canvas:{}},async()=>canvas,Pdf);
 assert.equal(pages,1);assert.equal(images.length,1);assert.ok(blob.size);
 assert.ok(Math.abs(images[0][4]/images[0][5]-1008/1100)<1e-9);
 assert.ok(images[0][4]<=10.5);assert.ok(images[0][5]<=7.95);
 assert.equal(canvas.width,0);assert.equal(canvas.height,0);
});


test('Quick Orientation portrait is rendered proportionally without cropping on one sheet',async()=>{
 let pages=1;
 class Pdf{
  addPage(){pages++}
  addImage(...args){this.image=args}
  output(){return new Blob(['pdf'])}
 }
 const sizes={};
 const img={
  naturalWidth:1600,naturalHeight:2400,
  decode:async()=>{},
  getBoundingClientRect:()=>({width:74,height:76}),
  closest:()=>null,
  style:{setProperty:(key,value)=>{sizes[key]=value},margin:''}
 };
 const report={
  querySelectorAll:()=>[img],
  getBoundingClientRect:()=>({height:820})
 };
 const container={querySelector:()=>report,ownerDocument:{createElement:()=>({})},append:()=>{},style:{}};
 const rendered=async()=>({width:2016,height:1640,toDataURL:()=> 'png'});
 const output=await renderQuickOrientationPdf(container,{inner:{width:10.5,height:7.95}},{jsPDF:{orientation:'landscape'},margin:[.25,.25],html2canvas:{}},rendered,Pdf);
 assert.ok(output.size);
 assert.equal(pages,1);
 assert.equal(sizes.height,'76px');
 assert.equal(sizes.width,(1600*(76/2400))+'px');
 assert.equal(img.style.margin,'auto');
});
