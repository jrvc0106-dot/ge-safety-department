import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function setup({archiveFails=false,canShare=false}={}){
 const messages=[],downloads=[],shares=[],report={innerHTML:'JHA with photos',querySelector:()=>({textContent:'JHA'}),querySelectorAll:()=>[]};
 const button={innerHTML:'Share PDF',textContent:'Share PDF',disabled:false};
 const blob=new Blob(['%PDF-1.4 test'],{type:'application/pdf'});
 const canvas={width:800,height:9000};
 const worker={set(){return this},from(){return this},toContainer(){return this},toCanvas(){return this},get(key){return Promise.resolve(key==='container'?{scrollWidth:800,scrollHeight:9000}:key==='overlay'?{remove(){}}:canvas)},outputPdf(){return Promise.resolve(blob)}};
 const context=vm.createContext({Blob,File,console:{warn(){}},URL:{createObjectURL:()=> 'blob:pdf',revokeObjectURL(){}},setTimeout(){},window:{open:()=>null},navigator:{canShare:()=>canShare,share:input=>{shares.push(input);return Promise.resolve()}},document:{querySelector:selector=>selector==='article.report'?report:button,createElement:()=>({click(){downloads.push(true)},remove(){}}),body:{appendChild(){}}},tr:en=>en,confirmAction:(...args)=>messages.push(args),error:err=>messages.push([err.message,'error']),currentReportIdentity:()=>({projectId:'original'}),reportPdfFilename:()=> 'JHA.pdf',waitForReportImages:async()=>{},mockRenderPdf:async()=>blob,registerFinalReport:async()=>{if(archiveFails)throw Error('Cloud offline')}});
 const helpers=source.slice(source.indexOf('const preparedReportPdfs='),source.indexOf('async function normalizeReportImage'));
 const actions=source.slice(source.indexOf('async function buildReportPdf('),source.indexOf('function installReportDocumentActions()')).replace("await import('./pdf-export.js')",'({renderPaginatedPdf:mockRenderPdf})');
 vm.runInContext(helpers+'\n'+actions,context);
 context.ensurePdfExporter=async()=>()=>worker;
 return {context,report,button,messages,downloads,shares};
}
test('cloud archive failure still downloads and repeated exports reuse the PDF',async()=>{
 const t=setup({archiveFails:true});await t.context.runPdfAction('download',t.button);await Promise.resolve();
 assert.equal(t.downloads.length,1);assert.ok(t.messages.some(m=>m[0].includes('cloud copy')));
 await t.context.runPdfAction('download',t.button);assert.equal(t.downloads.length,2);assert.equal(t.button.disabled,false);
});
test('sharing prepares once, then invokes native sharing directly from the next click',async()=>{
 const t=setup({canShare:true});await t.context.runPdfAction('share',t.button);assert.equal(t.shares.length,0);assert.match(t.button.textContent,/Share PDF now/);
 const pending=t.context.runPdfAction('share',t.button);assert.equal(t.shares.length,1);await pending;
 assert.equal(t.shares[0].files[0].type,'application/pdf');assert.equal(t.shares[0].files[0].name,'JHA.pdf');
});
test('unsupported file sharing downloads the attachment instead',async()=>{
 const t=setup();await t.context.runPdfAction('share',t.button);assert.equal(t.downloads.length,1);assert.equal(t.shares.length,0);
});
test('blocked PDF preview falls back to download',async()=>{
 const t=setup();await t.context.runPdfAction('view',t.button);assert.equal(t.downloads.length,1);
});
test('changed reports invalidate prepared PDFs',async()=>{
 const t=setup();await t.context.buildReportPdf();assert.ok(t.context.preparedReportPdf(t.report));t.report.innerHTML+=' updated';assert.equal(t.context.preparedReportPdf(t.report),null);
});
test('long mobile reports respect canvas dimensions and memory limits',()=>{
 const t=setup();for(const [w,h] of [[768,2000],[768,20000],[900,100000]]){const scale=t.context.pdfCanvasScale(w,h);assert.ok(scale>0&&scale<=3);assert.ok(w*h*scale*scale<=4000000.01);assert.ok(Math.max(w,h)*scale<=8192.01)}
});
test('canceled sharing restores controls and does not download',async()=>{
 const t=setup({canShare:true});await t.context.buildReportPdf(true);t.context.navigator.share=()=>Promise.reject(Object.assign(Error('Canceled'),{name:'AbortError'}));await t.context.runPdfAction('share',t.button);assert.equal(t.downloads.length,0);assert.equal(t.button.disabled,false);assert.ok(t.messages.some(m=>m[0]==='Sharing canceled.'));
});

test('preview PDF cannot satisfy a high quality download or share',async()=>{
 const t=setup();await t.context.buildReportPdf();assert.equal(t.context.preparedReportPdf(t.report,true),null);await t.context.buildReportPdf(true);assert.equal(t.context.preparedReportPdf(t.report,true).highQuality,true);
});
