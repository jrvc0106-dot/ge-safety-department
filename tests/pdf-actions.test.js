import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function setup({archiveFails=false,canShare=false,userAgent='test-browser'}={}){
 const messages=[],downloads=[],shares=[],metrics=[],report={innerHTML:'JHA with photos',querySelector:()=>({textContent:'JHA'}),querySelectorAll:()=>[]};
 const button={innerHTML:'Share PDF',textContent:'Share PDF',disabled:false};
 const blob=new Blob(['%PDF-1.4 test'],{type:'application/pdf'});
 const canvas={width:800,height:9000};
 const worker={set(){return this},from(){return this},toContainer(){return this},toCanvas(){return this},get(key){return Promise.resolve(key==='container'?{scrollWidth:800,scrollHeight:9000}:key==='overlay'?{remove(){}}:canvas)},outputPdf(){return Promise.resolve(blob)}};
 const context=vm.createContext({Blob,File,console:{warn(){}},URL:{createObjectURL:()=> 'blob:pdf',revokeObjectURL(){}},setTimeout(){},window:{open:()=>null},navigator:{userAgent,canShare:()=>canShare,share:input=>{shares.push(input);return Promise.resolve()}},document:{querySelector:selector=>selector==='article.report'?report:button,createElement:()=>({click(){downloads.push(true)},remove(){}}),body:{appendChild(){}}},tr:en=>en,db:{},recordPerformanceMetric:(_db,event)=>{metrics.push(event);return Promise.resolve()},performance:{now:()=>100},confirmAction:(...args)=>messages.push(args),error:err=>messages.push([err.message,'error']),currentReportIdentity:()=>({projectId:'original'}),reportPdfFilename:()=> 'JHA.pdf',waitForReportImages:async()=>{},mockRenderPdf:async()=>blob,registerFinalReport:async()=>{if(archiveFails)throw Error('Cloud offline')}});
 const helpers=source.slice(source.indexOf('const preparedReportPdfs='),source.indexOf('async function normalizeReportImage'));
 const actions=source.slice(source.indexOf('async function buildReportPdf('),source.indexOf('function installReportDocumentActions()')).replace("await import('./pdf-export.js')",'({renderPaginatedPdf:mockRenderPdf})');
 vm.runInContext(helpers+'\n'+actions,context);
 context.ensurePdfExporter=async()=>()=>worker;
 context.renderPaginatedPdf=async()=>blob;
 context.rasterizePdfSignatures=async()=>{};
 context.state={page:'safetyWalkReport',project:'project-1',profile:{id:'user-1'}};
 return {context,report,button,messages,downloads,shares,metrics};
}
test('cloud archive failure still downloads and repeated exports reuse the PDF',async()=>{
 const t=setup({archiveFails:true});await t.context.runPdfAction('download',t.button);await Promise.resolve();
 assert.equal(t.downloads.length,1);assert.ok(t.messages.some(m=>m[0].includes('cloud copy')));
 await t.context.runPdfAction('download',t.button);assert.equal(t.downloads.length,2);assert.equal(t.button.disabled,false);
});

test('download rasterizes saved signatures in the PDF clone before page rendering',async()=>{
 const t=setup();let rasterized=false,rendered=false;
 t.context.rasterizePdfSignatures=async container=>{assert.ok(container);rasterized=true};
 t.context.renderPaginatedPdf=async()=>{assert.equal(rasterized,true);rendered=true;return new Blob(['%PDF-1.4 signed'],{type:'application/pdf'})};
 const snapshot=t.report.innerHTML;await t.context.runPdfAction('download',t.button);assert.equal(rendered,true);assert.equal(t.downloads.length,1);assert.equal(t.report.innerHTML,snapshot);
});
test('a signature rendering failure stops download and restores its control for retry',async()=>{
 const t=setup();t.context.rasterizePdfSignatures=async()=>{throw Error('Unable to render the saved digital signature.')};
 await t.context.runPdfAction('download',t.button);assert.equal(t.downloads.length,0);assert.equal(t.button.disabled,false);assert.ok(t.messages.some(m=>m[0].includes('saved digital signature')));assert.equal(t.context.preparedReportPdf(t.report),null);
});
test('sharing prepares once, then invokes native sharing directly from the next click',async()=>{
 const t=setup({canShare:true});await t.context.runPdfAction('share',t.button);assert.equal(t.shares.length,0);assert.match(t.button.textContent,/Share PDF now/);
 const pending=t.context.runPdfAction('share',t.button);assert.equal(t.shares.length,1);await pending;
 assert.equal(t.shares[0].files[0].type,'application/pdf');assert.equal(t.shares[0].files[0].name,'JHA.pdf');
});
test('PDF performance timing stops when the native share sheet opens',async()=>{
 const t=setup({canShare:true});await t.context.buildReportPdf(true);
 let now=100,finishShare;t.context.performance.now=()=>now;
 t.context.navigator.share=()=>new Promise(resolve=>{finishShare=resolve});
 const pending=t.context.runPdfAction('share',t.button);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(typeof finishShare,'function');
 assert.equal(t.metrics.length,1);
 assert.equal(t.metrics[0].metric,'pdf_action');
 const preparedDuration=t.metrics[0].duration;
 now=120000;finishShare();await pending;
 assert.equal(t.metrics[0].duration,preparedDuration);
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

test('JHA prepared sharing falls back to the PDF attachment when native sharing is denied',async()=>{
 const t=setup({canShare:true});t.report.dataset={pdfViewMode:'single-click'};await t.context.buildReportPdf(true);
 t.context.navigator.share=()=>Promise.reject(Object.assign(Error('file sharing denied'),{name:'NotAllowedError'}));
 await t.context.runPdfAction('share',t.button);
 assert.equal(t.downloads.length,1);assert.equal(t.button.disabled,false);assert.ok(t.messages.some(m=>m[0].includes('Attach this file')));
 assert.ok(t.context.preparedReportPdf(t.report,true));
});

test('native sharing denial in other modules falls back to the PDF attachment',async()=>{
 const t=setup({canShare:true});t.context.state.page='inventoryReport';t.report.dataset={pdfViewMode:'single-click'};await t.context.buildReportPdf(true);
 t.context.navigator.share=()=>Promise.reject(Object.assign(Error('file sharing denied'),{name:'NotAllowedError'}));
 await t.context.runPdfAction('share',t.button);
 assert.equal(t.downloads.length,1);assert.equal(t.button.disabled,false);assert.ok(t.messages.some(m=>m[0].includes('Attach this file')));
 assert.ok(t.context.preparedReportPdf(t.report,true));
});

test('preview PDF cannot satisfy a high quality download or share',async()=>{
 const t=setup();await t.context.buildReportPdf();assert.equal(t.context.preparedReportPdf(t.report,true),null);await t.context.buildReportPdf(true);assert.equal(t.context.preparedReportPdf(t.report,true).highQuality,true);
});

test('view, download and share all reuse the same final high resolution PDF',async()=>{
 const t=setup({canShare:true});await t.context.runPdfAction('view',t.button);
 const final=t.context.preparedReportPdf(t.report,true);assert.ok(final);assert.equal(final.highQuality,true);
 await t.context.runPdfAction('download',t.button);assert.equal(t.context.preparedReportPdf(t.report,true).blob,final.blob);
 await t.context.runPdfAction('share',t.button);assert.equal(t.shares.length,1);assert.equal(t.shares[0].files[0].size,final.blob.size);
});

test('an unfinished or failed report cannot export an incomplete PDF',async()=>{
 const t=setup();t.report.dataset={loading:'true'};await assert.rejects(t.context.buildReportPdf(),/still loading/);assert.equal(t.context.preparedReportPdf(t.report),null);
 t.report.dataset.loading='error';await assert.rejects(t.context.buildReportPdf(),/finish loading/);t.report.dataset.loading='false';assert.ok(await t.context.buildReportPdf());
});
test('recovering an expired image does not falsely invalidate the finished PDF',async()=>{
 const t=setup();t.context.waitForReportImages=async report=>{report.innerHTML+=' recovered image source'};
 const prepared=await t.context.buildReportPdf(true);assert.ok(prepared.blob.size);assert.equal(prepared.snapshot,t.report.innerHTML);
});
test('JHA first preview prepares in the app without opening about:blank, then opens the ready PDF synchronously',async()=>{
 const t=setup(),opened=[];t.report.dataset={pdfViewMode:'ready-first'};const query=t.context.document.querySelector;t.context.document.querySelector=selector=>selector==='.pdf-share'?{textContent:''}:query(selector);t.context.window.open=url=>{opened.push(url);return {opener:{},closed:false}};
 await t.context.runPdfAction('view',t.button);assert.deepEqual(opened,[]);assert.match(t.button.textContent,/View PDF now/);assert.ok(t.context.preparedReportPdf(t.report,true));
 const pending=t.context.runPdfAction('view',t.button);assert.deepEqual(opened,['blob:pdf']);await pending;assert.equal(t.button.disabled,false);
});
test('JHA preview after download opens the existing PDF immediately and a blocked preview falls back to download',async()=>{
 const t=setup(),opened=[];t.report.dataset={pdfViewMode:'ready-first'};await t.context.runPdfAction('download',t.button);t.context.window.open=url=>{opened.push(url);return null};
 const pending=t.context.runPdfAction('view',t.button);assert.deepEqual(opened,['blob:pdf']);assert.equal(t.downloads.length,2);await pending;assert.ok(!opened.includes('about:blank'));
});

for(const action of ['view','download']){
 test(`prepared single-click JHA ${action} executes before returning to the event loop`,async()=>{
  const t=setup();t.report.dataset={pdfViewMode:'single-click'};await t.context.buildReportPdf(true);
  const opened=[];t.context.window.open=url=>{opened.push(url);return {closed:false}};
  t.context.buildReportPdf=()=>{throw Error('must reuse the ready PDF')};
  const pending=t.context.runPdfAction(action,t.button);
  if(action==='view')assert.deepEqual(opened,['blob:pdf']);else assert.equal(t.downloads.length,1);
  await pending;
 });
}
test('single-click JHA falls back to download when opening a cached preview throws',async()=>{
 const t=setup();t.report.dataset={pdfViewMode:'single-click'};await t.context.buildReportPdf(true);
 t.context.window.open=()=>{throw Error('Safari blocked popup')};await t.context.runPdfAction('view',t.button);
 assert.equal(t.downloads.length,1);assert.equal(t.button.disabled,false);
});
test('single-click JHA falls back if Safari refuses to navigate the reserved window',async()=>{
 const t=setup();t.report.dataset={pdfViewMode:'single-click'};let closed=false;
 t.context.window.open=()=>({closed:false,close(){closed=true},location:{set href(value){throw Error('navigation blocked')}}});
 await t.context.runPdfAction('view',t.button);assert.equal(t.downloads.length,1);assert.ok(closed);
});
test('leaving JHA releases its cached PDF and recovered image URLs without revoking an open preview',async()=>{
 const t=setup(),revoked=[];t.report.dataset={pdfViewMode:'single-click'};await t.context.buildReportPdf(true);
 t.context.URL.revokeObjectURL=url=>revoked.push(url);
 t.context.reportForCleanup=t.report;
 vm.runInContext("jhaReportImageUrls.set(reportForCleanup,new Set(['blob:recovered-photo']))",t.context);
 t.context.releaseJhaPdfResources(t.report);assert.equal(t.context.preparedReportPdf(t.report,true),null);
 assert.deepEqual(revoked,['blob:recovered-photo']);
 t.context.releaseJhaPdfResources(t.report);assert.equal(revoked.length,1);
});
test('first JHA share uses native sharing if activation survives rendering',async()=>{
 const t=setup({canShare:true});t.report.dataset={pdfViewMode:'single-click'};t.context.navigator.userActivation={isActive:true};
 await t.context.runPdfAction('share',t.button);assert.equal(t.shares.length,1);assert.equal(t.downloads.length,0);
});
test('expired Safari activation keeps JHA PDF ready for a second sharing tap',async()=>{
 const t=setup({canShare:true});t.report.dataset={pdfViewMode:'single-click'};t.context.navigator.userActivation={isActive:true};
 t.context.navigator.share=()=>Promise.reject(Object.assign(Error('activation expired'),{name:'NotAllowedError'}));
 await t.context.runPdfAction('share',t.button);assert.match(t.button.textContent,/Share PDF now/);assert.equal(t.downloads.length,0);assert.ok(t.context.preparedReportPdf(t.report,true));assert.equal(t.button.disabled,false);
});


test('first share tap uses native file sharing in other report modules when activation survives rendering',async()=>{
 const t=setup({canShare:true});t.context.state.page='inventoryReport';t.context.navigator.userActivation={isActive:true};
 await t.context.runPdfAction('share',t.button);assert.equal(t.shares.length,1);assert.equal(t.downloads.length,0);
});

test('expired activation in other modules leaves the prepared PDF ready for a second sharing tap',async()=>{
 const t=setup({canShare:true});t.context.state.page='inventoryReport';t.context.navigator.userActivation={isActive:true};
 t.context.navigator.share=()=>Promise.reject(Object.assign(Error('activation expired'),{name:'NotAllowedError'}));
 await t.context.runPdfAction('share',t.button);assert.equal(t.shares.length,0);assert.equal(t.downloads.length,0);
 assert.ok(t.messages.some(m=>m[0].includes('Tap “Share PDF now”')));assert.ok(t.context.preparedReportPdf(t.report,true));
 assert.equal(t.button.disabled,false);
});
test('report navigation observer releases JHA resources when the report is replaced',async()=>{
 const t=setup();t.report.dataset={pdfViewMode:'single-click'};await t.context.buildReportPdf(true);
 t.context.reportForCleanup=t.report;t.context.installReportDocumentActions=()=>{};
 t.context.MutationObserver=class{constructor(callback){this.callback=callback}};
 const observerSource=source.slice(source.indexOf('const reportActionObserver='),source.indexOf('reportActionObserver.observe('));
 vm.runInContext('activeJhaPdfReport=reportForCleanup;'+observerSource,t.context);
 t.context.document.querySelector=()=>null;
 vm.runInContext('reportActionObserver.callback()',t.context);
 assert.equal(t.context.preparedReportPdf(t.report,true),null);
 assert.equal(vm.runInContext('activeJhaPdfReport',t.context),null);
});

for(const page of ['report','observationReport','disciplineReport','incidentReport','equipmentInspectionReport','inventoryReport','safetyToolReport'])test(`${page} installs all three guarded PDF actions and tracks resources for release`,()=>{
 const buttons=Object.fromEntries(['view','download','share'].map(action=>['.pdf-'+action,{}]));
 const actions={querySelector:selector=>buttons[selector]},report={},bar={dataset:{},appendChild(){}};let attached=false;
 const context=vm.createContext({state:{page},document:{querySelector:selector=>selector==='article.report'?report:bar,createElement:()=>actions},tr:x=>x,runPdfAction(){},attachJhaPdfActions:(installed,tracked,options)=>{assert.equal(installed,actions);assert.equal(tracked,report);assert.equal(options.isCurrent(),true);attached=true},window:{},setTimeout});
 const start=source.indexOf('function installReportDocumentActions()'),end=source.indexOf('const reportActionObserver=');
 vm.runInContext('let activeJhaPdfReport=null;'+source.slice(start,end),context);context.installReportDocumentActions();
 assert.equal(attached,true);assert.equal(vm.runInContext('activeJhaPdfReport',context),report);
});


test('Employee Medical Follow-up exposes Download PDF and Share PDF actions',()=>{
 const report={dataset:{toolKind:'medical_followup'},before(){}};
 const bar={dataset:{},appendChild(){}};
 const buttons={'.pdf-view':{},'.pdf-download':{},'.pdf-share':{}};
 const actions={innerHTML:'',className:'',querySelector:selector=>actions.innerHTML.includes(selector.slice(1))?buttons[selector]:null};
 const attached=[];
 const context=vm.createContext({state:{page:'safetyToolReport'},document:{querySelector:selector=>selector==='article.report'?report:selector==='.report-actions'?bar:null,createElement:()=>actions},tr:x=>x,runPdfAction(){},attachJhaPdfActions:(installed,tracked)=>attached.push({installed,tracked}),window:{},setTimeout});
 const start=source.indexOf('function installReportDocumentActions()'),end=source.indexOf('const reportActionObserver=');
 vm.runInContext('let activeJhaPdfReport=null;'+source.slice(start,end),context);
 context.installReportDocumentActions();
 assert.match(actions.innerHTML,/pdf-download/);assert.match(actions.innerHTML,/pdf-share/);
 assert.ok(buttons['.pdf-download'].onclick);assert.ok(buttons['.pdf-share'].onclick);
 assert.equal(attached[0].tracked,report);
});

test('Employee Medical Follow-up PDF is not archived to shared cloud reports',()=>{
 const report={dataset:{toolKind:'medical_followup'}};
 const context=vm.createContext({state:{page:'safetyToolReport',project:'project-1',profile:{id:'user-1'}}});
 const start=source.indexOf('function currentReportIdentity('),end=source.indexOf('async function registerFinalReport(');
 vm.runInContext(source.slice(start,end),context);
 assert.equal(context.currentReportIdentity(report),null);
});


test('PDF actions record duration and distinguish app failures from user cancellations',async()=>{
 const ok=setup();await ok.context.runPdfAction('download',ok.button);assert.equal(ok.metrics.length,1);
 assert.equal(ok.metrics[0].metric,'pdf_action');assert.equal(ok.metrics[0].page,'safetyWalkReport:download');assert.equal(ok.metrics[0].duration,0);
 const failed=setup();failed.context.rasterizePdfSignatures=async()=>{throw Error('render failed')};await failed.context.runPdfAction('download',failed.button);
 assert.equal(failed.metrics[0].metric,'pdf_failure');
 const canceled=setup({canShare:true});await canceled.context.buildReportPdf(true);canceled.context.navigator.share=()=>Promise.reject(Object.assign(Error('Canceled'),{name:'AbortError'}));
 await canceled.context.runPdfAction('share',canceled.button);assert.equal(canceled.metrics[0].metric,'pdf_action');assert.equal(canceled.metrics[0].duration,0);assert.equal(canceled.metrics[1].metric,'pdf_cancelled');assert.equal(canceled.metrics[1].duration,0);
});

test('iPad Safari Web Share API shares a finished PDF when file sharing is available',async()=>{
 const t=setup({canShare:true,userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 t.context.navigator.userActivation={isActive:true};
 await t.context.runPdfAction('share',t.button);
 assert.equal(t.shares.length,1);
 assert.equal(t.shares[0].files[0].type,'application/pdf');
 assert.equal(t.downloads.length,0);
});

test('Samsung Android browser downloads the PDF when file sharing is unavailable',async()=>{
 const t=setup({canShare:false,userAgent:'Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 Chrome/132.0.0.0 Mobile Safari/537.36'});
 await t.context.runPdfAction('share',t.button);
 assert.equal(t.shares.length,0);
 assert.equal(t.downloads.length,1);
 assert.ok(t.messages.some(m=>m[0].includes('Attach this file')));
});
