import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const functionSource=source.slice(source.indexOf('async function waitForReportImages('),source.indexOf('function reportPdfFilename('));

function contextFor(img,fetchImpl){
  const context=vm.createContext({
    fetch:fetchImpl,
    URL:{createObjectURL:()=> 'blob:report-image'},
    requestAnimationFrame:callback=>callback(),
    setTimeout,
    clearTimeout,
    tr:en=>en
  });
  vm.runInContext(functionSource,context);
  return {context,report:{querySelectorAll:()=>[img]}};
}

test('failed report images are recovered through a local blob before PDF rendering',async()=>{
  let assigned='';
  const img={complete:true,naturalWidth:0,currentSrc:'https://storage/photo.jpg',addEventListener(){},get src(){return assigned},set src(value){assigned=value;this.naturalWidth=120}};
  const {context,report}=contextFor(img,async()=>({ok:true,blob:async()=>new Blob(['photo'],{type:'image/jpeg'})}));
  await context.waitForReportImages(report);
  assert.equal(assigned,'blob:report-image');
});

test('a truly unavailable report image still prevents an incomplete PDF',async()=>{
  const img={complete:true,naturalWidth:0,currentSrc:'https://storage/missing.jpg',src:'',addEventListener(){}};
  const {context,report}=contextFor(img,async()=>({ok:false}));
  await assert.rejects(context.waitForReportImages(report),/1 image\(s\) did not load/);
});
