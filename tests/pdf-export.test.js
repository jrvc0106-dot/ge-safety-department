import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderPaginatedPdf,pdfCanvasPageIsBlank,indexPdfEvidencePositions,pdfPageRasterChoice} from '../src/pdf-export.js';
const options={jsPDF:{unit:'in',format:'letter'},margin:[.25,.25,.3,.25],html2canvas:{useCORS:true}};
const pageSize={inner:{width:8,px:{height:1003}}};
test('long exports keep 200 DPI on every page with high-quality JPEG and release memory',async()=>{
 const renders=[],images=[],canvases=[];let pages=1;
 const render=async(_,opts)=>{renders.push(opts);const canvas={width:1600,height:Math.ceil(opts.height*opts.scale),toDataURL:(type,quality)=>{assert.equal(type,'image/jpeg');assert.equal(quality,0.92);return 'data:image/jpeg;base64,test'}};canvases.push(canvas);return canvas};
 class Pdf{addPage(){pages++}addImage(...args){images.push(args)}output(type){assert.equal(type,'blob');return new Blob(['%PDF-1.4'])}}
 const blob=await renderPaginatedPdf({scrollHeight:10030},pageSize,options,render,Pdf);
 assert.equal(pages,10);assert.equal(images.length,10);assert.ok(blob.size);
 for(let i=0;i<renders.length;i++){assert.equal(renders[i].scale,200/96);assert.equal(renders[i].width,768);assert.equal(renders[i].height,1003);assert.equal(renders[i].y,i*1003);assert.equal(images[i][1],'JPEG');assert.equal(canvases[i].width,0);assert.equal(canvases[i].height,0)}
});
test('last partial page retains physical proportions and no extra blank page',async()=>{
 const heights=[],images=[];let pages=1;
 class Pdf{addPage(){pages++}addImage(...args){images.push(args)}output(){return new Blob(['pdf'])}}
 await renderPaginatedPdf({scrollHeight:1103},pageSize,options,async(_,opts)=>{heights.push(opts.height);return {width:1600,height:Math.ceil(opts.height*opts.scale),toDataURL:()=> 'png'}},Pdf);
 assert.deepEqual(heights,[1003,100]);assert.equal(pages,2);assert.equal(images[1][4],8);assert.equal(images[1][5],100/96);
});
test('failed rendering releases its page canvas and returns an error',async()=>{
 const canvas={width:0,height:100};class Pdf{}
 await assert.rejects(renderPaginatedPdf({scrollHeight:20},pageSize,options,async()=>canvas,Pdf),/Unable to render PDF page 1/);assert.equal(canvas.height,0);
});

test('real PDF encoder produces a valid two-page document with embedded JPEG images',async()=>{
 const jpeg='data:image/jpeg;base64,'+'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==';
 const blob=await renderPaginatedPdf({scrollHeight:1103},pageSize,options,async(_,opts)=>({width:1600,height:Math.ceil(opts.height*200/96),toDataURL:()=>jpeg}));
 const text=await blob.text();assert.ok(text.startsWith('%PDF-'));assert.match(text,/\/Count 2\b/);assert.match(text,/\/Subtype \/Image/);assert.match(text,/\/DCTDecode/);
});

test('JHA first fully white canvas is not exported as a blank opening page',async()=>{
 const previous=globalThis.document;let pages=1;
 const images=[],rendered=[];
 globalThis.document={createElement:()=>({
  width:0,height:0,getContext(){return{
   drawImage(canvas){this.source=canvas},
   getImageData(){const data=new Uint8ClampedArray(128*160*4);data.fill(255);
    if(this.source?.ink)for(let i=0;i<120;i++){const p=((10+Math.floor(i/90))*128+6+(i%90))*4;data[p]=20;data[p+1]=20;data[p+2]=20}
    return{data};
   }
  }}
 })};
 class Pdf{addPage(){pages++}addImage(x){images.push(x)}output(){return new Blob(['pdf'])}}
 try{
  const img=async(_,opts)=>{rendered.push(opts.y);return {
   width:1600,height:Math.ceil(opts.height*200/96),ink:opts.y>0,
   toDataURL(){return'data:image/jpeg;base64,sample'}
  }};
  await renderPaginatedPdf({scrollHeight:2006},pageSize,
   {...options,skipBlankLeadingPage:true},img,Pdf);
  assert.deepEqual(rendered,[0,1003]);
  assert.equal(pages,1,'No blank leading PDF sheet must be added');
  assert.equal(images.length,1,'Only the actual report page is retained');
 }finally{globalThis.document=previous}
});

test('a nonblank JHA first page and all non-JHA page layouts stay unchanged',async()=>{
 const previous=globalThis.document;let pages=1,count=0;
 globalThis.document={createElement:()=>({
  width:0,height:0,getContext(){return {
   drawImage(){},
   getImageData(){const data=new Uint8ClampedArray(64*80*4).fill(30);for(let i=3;i<data.length;i+=4)data[i]=255;return{data}}
  }}
 })};
 class Pdf{addPage(){pages++}addImage(){count++}output(){return new Blob(['pdf'])}}
 try{
  await renderPaginatedPdf({scrollHeight:2006},pageSize,{...options,skipBlankLeadingPage:true},
   async(_,opts)=>({width:1600,height:Math.ceil(opts.height*200/96),toDataURL:()=>''}),Pdf);
  assert.equal(pages,2);assert.equal(count,2);
  pages=1;count=0;
  globalThis.document={createElement:()=>{throw Error('Only JHA may scan blank raster')}};
  await renderPaginatedPdf({scrollHeight:2006},pageSize,options,
   async(_,opts)=>({width:1600,height:Math.ceil(opts.height*200/96),toDataURL:()=>''}),Pdf);
  assert.equal(pages,2);assert.equal(count,2);
 }finally{globalThis.document=previous}
});

test('a completely blank JHA document is rejected instead of being saved',async()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({
  width:0,height:0,getContext(){return {
   drawImage(){},getImageData(){return{data:new Uint8ClampedArray(64*80*4).fill(255)}}
  }}
 })};
 class Pdf{addPage(){}addImage(){throw Error('Must not include blank image')}output(){return new Blob(['pdf'])}}
 try{
  await assert.rejects(renderPaginatedPdf({scrollHeight:1003},pageSize,
   {...options,skipBlankLeadingPage:true},
   async()=>({width:1600,height:2089,toDataURL:()=>''}),Pdf),
   /no visible page content/);
 }finally{globalThis.document=previous}
});


test('JHA rejects a leading white page with only faint gray frame artifacts',async()=>{
 const original=globalThis.document;let count=0;
 globalThis.document={createElement:()=>({
  width:0,height:0,getContext(){return{
   drawImage(canvas){this.page=canvas},
   getImageData(){
    const data=new Uint8ClampedArray(128*160*4).fill(255);
    if(this.page?.backgroundArtifact)for(let i=0;i<180;i++){
     const p=(i+128*80)*4;
     data[p]=226;data[p+1]=226;data[p+2]=226;data[p+3]=255;
    }
    if(this.page?.hasHeader)for(let y=7;y<17;y++)for(let x=8;x<90;x++){
     const p=(y*128+x)*4;data[p]=33;data[p+1]=43;data[p+2]=55;data[p+3]=255;
    }
    return {data};
   }
  }}
 })};
 class Pdf{addPage(){}addImage(){count++}output(){return new Blob(['pdf'])}}
 try{
  await renderPaginatedPdf({scrollHeight:2006},pageSize,{...options,skipBlankLeadingPage:true},
   async(_,opts)=>({width:1600,height:2000,backgroundArtifact:opts.y===0,hasHeader:opts.y>0,toDataURL:()=>''}),Pdf);
  assert.equal(count,1,'A visually blank first page should not precede the report');
 }finally{globalThis.document=original}
});

test('JHA must retain a genuine opening page with its report title/header',async()=>{
 const original=globalThis.document;let count=0,pages=1;
 globalThis.document={createElement:()=>({
  width:0,height:0,getContext(){return{
   drawImage(canvas){this.page=canvas},
   getImageData(){
    const data=new Uint8ClampedArray(128*160*4).fill(255);
    if(this.page?.hasHeader)for(let y=5;y<20;y++)for(let x=9;x<95;x++){
     const p=(y*128+x)*4;data[p]=30;data[p+1]=49;data[p+2]=61;data[p+3]=255;
    }
    return {data};
   }
  }}
 })};
 class Pdf{addPage(){pages++}addImage(){count++}output(){return new Blob(['pdf'])}}
 try{
  await renderPaginatedPdf({scrollHeight:2006},pageSize,{...options,skipBlankLeadingPage:true},
   async()=>({width:1600,height:2000,hasHeader:true,toDataURL:()=>''}),Pdf);
  assert.equal(count,2,'No real report heading or signatures may be dropped');
  assert.equal(pages,2);
 }finally{globalThis.document=original}
});

test('image page classification measures evidence once without changing raster quality',()=>{
 let measured=0,selected=0;
 const image={getAttribute:()=>'/jobsite-evidence.jpg',getBoundingClientRect(){measured++;return {top:100,bottom:180}}};
 const logo={getAttribute:()=>'/ge-logo.png',getBoundingClientRect(){throw Error('logo is not evidence')}};
 const report={querySelectorAll(){selected++;return [logo,image]}};
 const container={scrollTop:0,querySelector:()=>report,getBoundingClientRect:()=>({top:0})};
 const index=indexPdfEvidencePositions(container);
 assert.deepEqual(index,[[100,180]]);
 for(let page=0;page<5;page++){
  const raster=pdfPageRasterChoice(container,page*100,100,index);
  assert.equal(raster.format,page===1?'JPEG':'PNG');
  if(page===1)assert.equal(raster.quality,0.96,'photos retain original 96% JPEG quality');
 }
 assert.equal(measured,1,'image layout is measured once per export, not per page');
 assert.equal(selected,1);
 assert.equal(pdfPageRasterChoice(container,100,100).format,'JPEG','original two-argument API works');
});
