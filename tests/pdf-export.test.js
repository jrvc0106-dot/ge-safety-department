import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderPaginatedPdf} from '../src/pdf-export.js';
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
