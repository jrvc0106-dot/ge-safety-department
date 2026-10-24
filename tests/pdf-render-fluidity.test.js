import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {renderQuickOrientationPdf} from '../src/pdf-export.js';

test('Quick Orientation prepares all photo decodes concurrently while keeping PNG report fidelity',async()=>{
 const dom=new JSDOM('<div id="container"><section class="quick-safety-orientation-report"><div class="quick-report-header"><img></div><div class="quick-report-photos"><img></div></section></div>');
 const doc=dom.window.document,container=doc.querySelector('#container'),report=doc.querySelector('.quick-safety-orientation-report');
 const images=[...report.querySelectorAll('img')];let started=0,release=[];
 for(const img of images){
  Object.defineProperty(img,'naturalWidth',{value:300});
  Object.defineProperty(img,'naturalHeight',{value:150});
  img.getBoundingClientRect=()=>({width:150,height:75});
  img.decode=()=>{started++;return new Promise(resolve=>release.push(resolve))};
 }
 report.getBoundingClientRect=()=>({height:550});
 const seen=[];
 class PDF{
  addImage(...args){seen.push(args)}
  output(){return new Blob(['%PDF-1.4\nPage\n%%EOF'],{type:'application/pdf'})}
 }
 const options={jsPDF:{unit:'in',format:'letter'},margin:[.25,.25,.3,.25],html2canvas:{useCORS:true}};
 const pageSize={inner:{width:10.5,height:8}};
 const render=async(_report,args)=>{
  assert.equal(args.scale,2);assert.equal(args.width,1008);
  return {width:2016,height:1100,toDataURL:type=>{assert.equal(type,'image/png');return 'data:image/png;base64,AAAA'}};
 };
 const promise=renderQuickOrientationPdf(container,pageSize,options,render,PDF);
 await Promise.resolve();await Promise.resolve();
 assert.equal(started,2,'parallel image decoding avoids serial photo delays');
 release.forEach(resolve=>resolve());
 const blob=await promise;
 assert.equal(blob.type,'application/pdf');
 assert.equal(seen.length,1);assert.equal(seen[0][1],'PNG');
 assert.equal(report.querySelectorAll('img').length,2,'employee evidence stays in the report');
 dom.window.close();
});

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const waitSource=main.slice(main.indexOf('async function waitForReportImages('),main.indexOf('function reportPdfFilename('));
const releaseSource=main.slice(main.indexOf('function releaseJhaPdfResources('),main.indexOf('let pdfActionBusy='));

test('photo recovery releases blob memory for incident and equipment PDFs after navigation',async()=>{
 let assigned='',revoked=[];
 const urls=new WeakMap(),cache=new WeakMap();
 const img={complete:true,naturalWidth:0,currentSrc:'https://example.test/signed.jpg',
  addEventListener(){},get src(){return assigned},set src(v){assigned=v;this.naturalWidth=450}};
 const report={querySelectorAll:()=>[img],dataset:{pdfViewMode:'ready-first'}};
 const ctx=vm.createContext({
  fetch:async()=>({ok:true,blob:async()=>new Blob(['photo'],{type:'image/jpeg'})}),
  URL:{createObjectURL:()=> 'blob:incident-photo',revokeObjectURL:v=>revoked.push(v)},
  document:{querySelector:()=>report,visibilityState:'hidden'},
  jhaReportImageUrls:urls,preparedReportPdfs:cache,
  state:{page:'incidentReport'},setTimeout,clearTimeout,tr:en=>en
 });
 vm.runInContext(waitSource+'\n'+releaseSource,ctx);
 await ctx.waitForReportImages(report);
 assert.equal(assigned,'blob:incident-photo');
 assert.ok(urls.get(report).has('blob:incident-photo'));
 ctx.releaseJhaPdfResources(report);
 assert.deepEqual(revoked,['blob:incident-photo']);
});

test('stalled image-retry requests are aborted instead of holding a PDF open indefinitely',async()=>{
 const img={complete:true,naturalWidth:0,currentSrc:'https://example.test/stalled.jpg',addEventListener(){}};
 const report={querySelectorAll:()=>[img],dataset:{pdfViewMode:'ready-first'}};
 let aborted=false;
 const ctx=vm.createContext({
  AbortController,document:{querySelector:()=>report,visibilityState:'hidden'},
  fetch:(_url,{signal})=>new Promise((resolve,reject)=>{
   signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'))},{once:true});
  }),
  URL:{createObjectURL:()=> 'blob:unexpected'},
  setTimeout:(cb,time)=>setTimeout(cb,time===12000?8:time),
  clearTimeout,state:{page:'incidentReport'},tr:en=>en
 });
 vm.runInContext(waitSource,ctx);
 await assert.rejects(ctx.waitForReportImages(report),/1 image\(s\) did not load/);
 assert.equal(aborted,true);
});
