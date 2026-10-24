import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {
 indexFinalPdfDocuments,archivedPdfFilename,archivedPdfLink,
 openArchivedPdf,downloadArchivedPdf,inspectArchivedPdf
} from '../src/finalized-pdf-direct.js';

const row=(overrides={})=>({
 project_id:'job-a',report_type:'daily_safety_walk',source_id:'walk-01',
 document_status:'final',version:1,report_number:'DSW-070',pdf_path:'job-a/daily_safety_walk/saved.pdf',
 created_at:'2026-10-20T12:00:00Z',...overrides
});
function mockStorage({size=1024,signError=null,infoError=null,downloadData}={}){
 const calls=[],file={
  async createSignedUrl(path,seconds,options){calls.push(['signed',path,seconds,options]);return {data:signError?null:{signedUrl:'https://test.supabase.co/storage/v1/object/sign/final-reports/saved.pdf?token=safe'},error:signError}},
  async info(path){calls.push(['info',path]);return {data:infoError?null:{size},error:infoError}},
  async download(path){calls.push(['download',path]);return {data:downloadData||new Blob(['%PDF-1.4\n','Page content '.repeat(9),'\n%%EOF'],{type:'application/pdf'}),error:null}}
 };
 return {storage:{from(bucket){assert.equal(bucket,'final-reports');return file}},calls};
}

test('index only includes this project’s original finished PDFs and selects newest valid version',()=>{
 const docs=[row({version:1}),row({version:3,pdf_path:'job-a/daily_safety_walk/v3.pdf'}),
  row({project_id:'job-b',version:9}),row({document_status:'under_review',version:7}),
  row({report_type:'tool_medical_followup',source_id:'private',version:1}),
  row({pdf_path:'',source_id:'none'}),row({source_id:null}),
  row({report_type:'disciplinary_action',source_id:'discipline-01',report_number:'DA-45'})];
 const index=indexFinalPdfDocuments(docs,'job-a');
 assert.equal(index.size,2);
 assert.equal(index.get('daily_safety_walk:walk-01').version,3);
 assert.equal(index.get('disciplinary_action:discipline-01').report_number,'DA-45');
 assert.equal(index.get('tool_medical_followup:private'),undefined);
 assert.equal(indexFinalPdfDocuments(docs,'job-c').size,0);
});

test('direct PDF links are signed only for authorized stored reports; no reconstruction or downloads',async()=>{
 const {storage,calls}=mockStorage();
 const url=await archivedPdfLink(storage,row());
 assert.ok(url.startsWith('https://test.supabase.co/'));
 assert.deepEqual(calls.map(x=>x[0]).sort(),['info','signed']);
 assert.equal(calls[0][2],180);
 assert.equal(calls.some(x=>x[0]==='download'),false);
});

test('a missing/empty PDF is rejected before preview or download (no blank zero-byte file)',async()=>{
 for(const size of [0,12]){
  const {storage}=mockStorage({size});
  await assert.rejects(archivedPdfLink(storage,row()),/empty or damaged/);
  await assert.rejects(archivedPdfLink(storage,row(),{download:true}),/empty or damaged/);
 }
 const {storage}=mockStorage();
 await assert.rejects(archivedPdfLink(storage,row({document_status:'draft'})),/not available/);
});

test('PDF download streams directly from signed Storage URL with safe attachment filename',async()=>{
 const {storage,calls}=mockStorage();
 const doc=new JSDOM('<body></body>',{url:'https://example.test/'}).window.document;
 const root=doc.createElement,clicks=[];
 doc.createElement=(tag)=>{
  const element=root.call(doc,tag);
  if(tag==='a')element.click=()=>clicks.push({href:element.href,download:element.download});
  return element;
 };
 const entry=row({report_number:'JHA:2026/11'});
 await downloadArchivedPdf(storage,entry,{doc});
 assert.equal(clicks.length,1);
 assert.equal(clicks[0].download,archivedPdfFilename(entry));
 assert.match(clicks[0].href,/token=safe/);
 assert.equal(calls.find(x=>x[0]==='signed')[3].download,archivedPdfFilename(entry));
 assert.equal(calls.some(x=>x[0]==='download'),false,'browser streams instead of holding big blobs');
 assert.equal(doc.querySelectorAll('a').length,0);
 doc.defaultView.close();
});

test('PDF view reserves a tab before the first asynchronous network operation',async()=>{
 let resolveLink;
 const calls=[],win={
  location:{assign:url=>calls.push(['same_tab',url])},
  open:()=>{
   calls.push(['popup_before_network']);
   return {closed:false,location:{set href(url){calls.push(['preview_url',url])}},close(){calls.push(['close'])}};
  }
 };
 const storage={from:()=>({
  createSignedUrl(){calls.push(['network']);return new Promise(res=>resolveLink=res)},
  info:async()=>({data:{size:1234},error:null})
 })};
 const promise=openArchivedPdf(storage,row(),{win});
 assert.deepEqual(calls.map(x=>x[0]),['popup_before_network','network']);
 resolveLink({data:{signedUrl:'https://test.supabase.co/saved.pdf?token=a'},error:null});
 await promise;
 assert.deepEqual(calls.map(x=>x[0]),['popup_before_network','network','preview_url']);
});

test('if project changed during signing, cancel preview and never leak the old report',async()=>{
 const calls=[],win={open(){return{closed:false,close(){calls.push('closed')},location:{set href(_){calls.push('navigated')}}}}};
 const {storage}=mockStorage();
 await assert.rejects(openArchivedPdf(storage,row(),{win,isCurrent:()=>false}),/changed/);
 assert.deepEqual(calls,['closed']);
});

test('full inspection detects invalid PDF bytes instead of trusting Storage metadata',async()=>{
 const valid=mockStorage();
 const result=await inspectArchivedPdf(valid.storage,row());
 assert.equal(result.valid,true);
 const empty=mockStorage({downloadData:new Blob([])});
 const broken=await inspectArchivedPdf(empty.storage,row());
 assert.deepEqual(broken,{valid:false,bytes:0});
});

test('the fast action is limited to Report Center; original report opening and PDFs remain untouched',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/function decorateFinalPdfShortcuts\(\)/);
 assert.match(source,/navigate\('safetyWalkReport',id\)/);
 assert.match(source,/indexFinalPdfDocuments\(registered,state\.project\)/);
 assert.match(source,/\.select\('id,project_id,report_type,source_id/);
 assert.match(source,/decorateDeleteButtons\(\);decorateFinalPdfShortcuts\(\)/);
 const css=readFileSync(new URL('../src/finalized-pdf-direct.css',import.meta.url),'utf8');
 assert.match(css,/@media print/);
 assert.doesNotMatch(css,/report\.pdf\s*\{/);
});


test('historical stored PDFs use original source date and title rather than archive date and version',()=>{
 const source=row({title:'Forklift',report_type:'equipment_inspection',
  original_report_date:'2026-10-23T14:00:00Z',
  created_at:'2026-10-24T16:00:00Z',version:9,report_number:'EQ-00023'});
 assert.equal(archivedPdfFilename(source),'Forklift Daily Report 10.23.2026 By G&E.pdf');
 const walk=row({title:'Daily Safety Walk Report',original_report_date:'2026-10-09',
  created_at:'2026-10-24T16:00:00Z'});
 assert.equal(archivedPdfFilename(walk),'Daily Safety Walk Report 10.09.2026 By G&E.pdf');
});

test('stored PDF download sends canonical original-date name in signed URL disposition and anchor',async()=>{
 const {storage,calls}=mockStorage();
 const doc=new JSDOM('<body></body>',{url:'https://ge-one.example/'}).window.document;
 const element=doc.createElement,clicked=[];
 doc.createElement=(tag)=>{
  const el=element.call(doc,tag);
  if(tag==='a')el.click=()=>clicked.push({name:el.download,href:el.href});
  return el;
 };
 const entry=row({title:'Forklift',report_type:'equipment_inspection',
  original_report_date:'2026-10-23',version:3,created_at:'2026-10-24T16:00:00Z'});
 await downloadArchivedPdf(storage,entry,{doc});
 assert.equal(clicked[0].name,'Forklift Daily Report 10.23.2026 By G&E.pdf');
 assert.equal(calls.find(x=>x[0]==='signed')[3].download,clicked[0].name);
 doc.defaultView.close();
});
