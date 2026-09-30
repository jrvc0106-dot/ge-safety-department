import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderPaginatedPdf} from '../src/pdf-export.js';
const options={jsPDF:{unit:'in',format:'letter'},margin:[.25,.25,.3,.25],html2canvas:{useCORS:true}};
const pageSize={inner:{width:8,px:{height:1003}}};
test('long exports keep 300 DPI on every page with lossless PNG and release memory',async()=>{
 const renders=[],images=[],canvases=[];let pages=1;
 const render=async(_,opts)=>{renders.push(opts);const canvas={width:2400,height:Math.ceil(opts.height*opts.scale),toDataURL:type=>{assert.equal(type,'image/png');return 'data:image/png;base64,test'}};canvases.push(canvas);return canvas};
 class Pdf{addPage(){pages++}addImage(...args){images.push(args)}output(type){assert.equal(type,'blob');return new Blob(['%PDF-1.4'])}}
 const blob=await renderPaginatedPdf({scrollHeight:10030},pageSize,options,render,Pdf);
 assert.equal(pages,10);assert.equal(images.length,10);assert.ok(blob.size);
 for(let i=0;i<renders.length;i++){assert.equal(renders[i].scale,300/96);assert.equal(renders[i].width,768);assert.equal(renders[i].height,1003);assert.equal(renders[i].y,i*1003);assert.equal(images[i][1],'PNG');assert.equal(canvases[i].width,0);assert.equal(canvases[i].height,0)}
});
test('last partial page retains physical proportions and no extra blank page',async()=>{
 const heights=[],images=[];let pages=1;
 class Pdf{addPage(){pages++}addImage(...args){images.push(args)}output(){return new Blob(['pdf'])}}
 await renderPaginatedPdf({scrollHeight:1103},pageSize,options,async(_,opts)=>{heights.push(opts.height);return {width:2400,height:Math.ceil(opts.height*opts.scale),toDataURL:()=> 'png'}},Pdf);
 assert.deepEqual(heights,[1003,100]);assert.equal(pages,2);assert.equal(images[1][4],8);assert.equal(images[1][5],100/96);
});
test('failed rendering releases its page canvas and returns an error',async()=>{
 const canvas={width:0,height:100};class Pdf{}
 await assert.rejects(renderPaginatedPdf({scrollHeight:20},pageSize,options,async()=>canvas,Pdf),/Unable to render PDF page 1/);assert.equal(canvas.height,0);
});

test('real PDF encoder produces a valid two-page document with embedded PNG images',async()=>{
 const {readFileSync}=await import('node:fs');
 const png='data:image/png;base64,'+readFileSync(new URL('../public/ge-logo.png',import.meta.url)).toString('base64');
 const blob=await renderPaginatedPdf({scrollHeight:1103},pageSize,options,async(_,opts)=>({width:2400,height:Math.ceil(opts.height*300/96),toDataURL:()=>png}));
 const text=await blob.text();assert.ok(text.startsWith('%PDF-'));assert.match(text,/\/Count 2\b/);assert.match(text,/\/Subtype \/Image/);
});
