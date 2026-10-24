import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {compactReportRow,reportCompactDate} from '../src/report-center-compact.js';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/report-center-compact.css',import.meta.url),'utf8');
const start=main.indexOf(' function decorateFinalPdfShortcuts(){');
const end=main.indexOf('\n let trashOpen=',start);
assert.ok(start>=0&&end>start,'Compact PDF action source must be present');
const code=main.slice(start,end);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function mountToolbar(){
 const html='<section class="report-center"><div id="report-library-list">'+
  compactReportRow({kind:'walk',id:'walk-a',title:'Daily Report (JHA)',creator:'Jorling Jirón',createdAt:'2026-10-24T13:00:00Z'},x=>x,escapeHtml)+
  compactReportRow({kind:'equipment',id:'equipment-a',title:'Equipment Inspection · JLG',creator:'Juan Benítez',createdAt:'2026-10-23T13:00:00Z'},x=>x,escapeHtml)+
  compactReportRow({kind:'walk',id:'not-finalized',title:'Daily Report (JHA)',creator:'Safety Worker',createdAt:'2026-10-22T13:00:00Z'},x=>x,escapeHtml)+
 '</div></section>';
 const dom=new JSDOM(html,{url:'https://ge-one.example'});
 const doc=dom.window.document,list=doc.querySelector('#report-library-list'),calls=[];
 const archives=new Map([
  ['daily_safety_walk:walk-a',{id:'arch-walk',project_id:'job-one',report_type:'daily_safety_walk',source_id:'walk-a',document_status:'final',pdf_path:'private/walk.pdf'}],
  ['equipment_inspection:equipment-a',{id:'arch-equipment',project_id:'job-one',report_type:'equipment_inspection',source_id:'equipment-a',document_status:'final',pdf_path:'private/equipment.pdf'}],
 ]);
 const ctx=vm.createContext({document:doc,list,archivedPdfs:archives,tr:x=>x,
  state:{project:'job-one'},viewCurrent:()=>true,currentCategory:'walks',window:dom.window,
  openArchivedPdf:async(_storage,entry)=>{calls.push('view:'+entry.id)},
  downloadArchivedPdf:async(_storage,entry)=>{calls.push('download:'+entry.id)},
  db:{storage:{}},error:e=>{throw e}
 });
 vm.runInContext(code+'\ndecorateFinalPdfShortcuts();',ctx);
 return {dom,doc,list,calls,ctx};
}

test('each compact line has only Ver PDF and Bajar PDF, never Save PDF',()=>{
 const t=mountToolbar();
 assert.equal(t.list.querySelectorAll('.report-compact-row').length,3);
 for(const line of t.list.querySelectorAll('.report-compact-row')){
  const buttons=[...line.querySelectorAll('.report-compact-action')];
  assert.deepEqual(buttons.map(b=>b.dataset.pdfAction),['view','download']);
  assert.deepEqual(buttons.map(b=>b.getAttribute('aria-label')),['View PDF','Download PDF']);
  assert.equal(line.querySelector('.final-pdf-shortcuts'),null);
 }
 t.dom.window.close();
});

test('both Safety names come from separate report records, not active viewer',()=>{
 const t=mountToolbar();
 const records=[...t.list.querySelectorAll('.report-compact-copy')];
 assert.match(records[0].textContent,/Jorling Jirón/);
 assert.match(records[1].textContent,/Juan Benítez/);
 assert.match(records[0].textContent,/Daily Report \(JHA\)/);
 assert.match(records[1].textContent,/Equipment Inspection · JLG/);
 assert.match(records[0].textContent,/10\.24\.2026/);
 t.dom.window.close();
});

test('saved PDFs open and download without opening HTML reports or saving another copy',async()=>{
 const t=mountToolbar();
 let navigation=0;
 t.list.querySelector('[data-id="walk-a"]').onclick=()=>navigation++;
 const walk=t.list.querySelector('[data-id="walk-a"]').closest('.report-compact-row');
 const equipment=t.list.querySelector('[data-id="equipment-a"]').closest('.report-compact-row');
 await walk.querySelector('[data-pdf-action="view"]').onclick();
 await walk.querySelector('[data-pdf-action="download"]').onclick();
 await equipment.querySelector('[data-pdf-action="download"]').onclick();
 assert.deepEqual(t.calls,['view:arch-walk','download:arch-walk','download:arch-equipment']);
 assert.equal(navigation,0);
 t.dom.window.close();
});

test('non-finalized reports do not download a different PDF or invent a saved file',()=>{
 const t=mountToolbar();
 const record=t.list.querySelector('[data-id="not-finalized"]');
 const row=record.closest('.report-compact-row');
 let opened=0;record.onclick=()=>opened++;
 const download=row.querySelector('[data-pdf-action="download"]');
 assert.equal(download.disabled,true);
 row.querySelector('[data-pdf-action="view"]').click();
 assert.equal(opened,1);
 assert.equal(download.title.includes('No saved final PDF'),true);
 t.dom.window.close();
});

test('PDF controls do not duplicate and reject an archived document from another project',async()=>{
 const t=mountToolbar();
 vm.runInContext('decorateFinalPdfShortcuts();',t.ctx);
 assert.equal(t.list.querySelectorAll('.report-compact-row').length,3);
 t.ctx.state.project='project-two';
 await t.list.querySelector('[data-id="walk-a"]').closest('.report-compact-row').querySelector('[data-pdf-action="download"]').onclick();
 assert.deepEqual(t.calls,[]);
 t.dom.window.close();
});

test('small responsive PDF actions stay isolated to Report Center and never restyle the PDFs',()=>{
 assert.match(styles,/\.report-center #report-library-list \.report-compact-row/);
 assert.match(styles,/\.report-compact-action/);
 assert.match(styles,/min-height:36px/);
 assert.match(styles,/@media\(max-width:540px\)/);
 assert.doesNotMatch(styles,/(?:article\.report|\.ge-reference-jha|\.equipment-pdf)\s*\{/);
});

test('empty creator shows truthful fallback and malicious names are escaped',()=>{
 assert.equal(reportCompactDate('bad-date'),'—');
 const unsafe=compactReportRow({kind:'walk',id:'1',title:'Daily Report (JHA)',creator:'<script>danger</script>',createdAt:'2026-10-24T12:00:00Z'},x=>x,escapeHtml);
 assert.ok(!unsafe.includes('<script>'));
 assert.ok(unsafe.includes('&lt;script&gt;'));
 const unknown=compactReportRow({kind:'walk',id:'2',title:'Daily Report (JHA)',creator:'',createdAt:'2026-10-24T12:00:00Z'},x=>x,escapeHtml);
 assert.ok(unknown.includes('Creator not recorded'));
});

test('main Report Center selects real persisted creators rather than the signed-in user',()=>{
 assert.ok(main.includes('creator:profiles!daily_safety_walks_created_by_fkey(name)'));
 assert.ok(main.includes('creator:profiles!equipment_inspections_created_by_fkey(name)'));
 assert.ok(main.includes('creator:profiles!incident_reports_created_by_fkey(name)'));
 assert.ok(main.includes("x.creator?.name"));
 assert.ok(main.includes("x.issuer?.name"));
 assert.ok(main.includes("x.author?.name"));
 assert.ok(!main.includes("readyArchivedPdf?.entryId"),'Report Center no longer has a third Save action');
});
