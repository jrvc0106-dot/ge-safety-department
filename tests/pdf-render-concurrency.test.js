import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('const preparedReportPdfs='),source.indexOf('async function normalizeReportImage'));
const actions=source.slice(source.indexOf('async function buildReportPdf('),source.indexOf('function installReportDocumentActions()'));
const pdf=()=>new Blob(['%PDF-1.4\n','Stable G&E PDF content '.repeat(4),'\n%%EOF'],{type:'application/pdf'});

function setup(){
 const report={innerHTML:'Permanent report snapshot',dataset:{},classList:{contains:()=>false},querySelector:()=>({textContent:'GE ONE Report'})};
 const container={scrollWidth:800,scrollHeight:1000,querySelectorAll:()=>[]};
 let workers=0,renders=0,waits=0,exporterLoads=0;
 const context=vm.createContext({
  Blob,File,WeakMap,Set,console:{warn(){}},
  document:{querySelector:key=>key==='article.report'?report:null,fonts:{ready:Promise.resolve()}},
  tr:en=>en,
  state:{page:'safetyWalkReport',profile:{id:'staff'},project:'job'},
  currentReportIdentity:()=>({projectId:'job'}),
  reportPdfFilename:()=> 'GE-ONE-final.pdf',
  waitForReportImages:async()=>{waits++},
  protectPdfReportLogos:()=>0,rasterizePdfSignatures:async()=>{},
  nativeReportArchiveAvailable:()=>false,
  registerFinalReport:async()=>null,
  isValidPdfBlob:async blob=>blob?.size>32,
  pdfCanvasScale:()=>1,
  URL:{createObjectURL:()=> 'blob:pdf',revokeObjectURL(){}},
  setTimeout,performance:{now:()=>100},
  error:()=>{},confirmAction:()=>{},
  navigator:{},window:{open:()=>null}
 });
 vm.runInContext(helpers+'\n'+actions,context);
 context.ensurePdfExporter=async()=>{
  exporterLoads++;
  return ()=>{workers++;
   return {set(){return this},from(){return this},toContainer(){return this},get:async key=>{
    if(key==='container')return container;
    if(key==='pageSize')return {inner:{px:{height:900},width:8,height:10.5}};
    if(key==='overlay')return {remove(){}};
   }};
  };
 };
 return {context,report,get workers(){return workers},get waits(){return waits},get exporterLoads(){return exporterLoads},
  setRenderer(fn){context.renderPaginatedPdf=async()=>{renders++;return fn()}},
  get renders(){return renders}};
}

test('final report: concurrent mobile PDF requests share the SAME render, and re-open instantly from cache',async()=>{
 const t=setup();let release;
 const gate=new Promise(resolve=>{release=resolve});
 t.setRenderer(()=>gate.then(pdf));
 const p1=t.context.buildReportPdf(true),p2=t.context.buildReportPdf(true),p3=t.context.buildReportPdf(true);
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 release();
 const results=await Promise.all([p1,p2,p3]);
 assert.equal(t.workers,1,'only one html2pdf worker must be created');
 assert.equal(t.waits,1,'images wait once, not on every click');
 assert.equal(t.renders,1,'high-quality PDF rendered only once');
 assert.strictEqual(results[0],results[1]);
 assert.strictEqual(results[1],results[2]);
 assert.strictEqual((await t.context.buildReportPdf(true)),results[0]);
 assert.equal(t.renders,1,'cached PDF is reused on subsequent open/share/download');
});

test('PDF render failure leaves no stuck in-flight promise; retry succeeds',async()=>{
 const t=setup();let attempt=0;
 t.setRenderer(()=>{if(++attempt===1)throw Error('Simulated iPad canvas failure');return pdf()});
 await assert.rejects(t.context.buildReportPdf(true),/Simulated iPad canvas failure/);
 const result=await t.context.buildReportPdf(true);
 assert.equal(result.filename,'GE-ONE-final.pdf');
 assert.equal(t.renders,2);
 assert.equal(t.workers,2);
});

test('unfinished report is never exported even when a previous PDF is cached',async()=>{
 const t=setup();t.setRenderer(pdf);
 await t.context.buildReportPdf(true);
 t.report.dataset.loading='true';
 await assert.rejects(t.context.buildReportPdf(true),/still loading/);
 assert.equal(t.renders,1);
});
