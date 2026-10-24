import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/finalized-pdf-direct.css',import.meta.url),'utf8');
const start=main.indexOf(' let readyArchivedPdf=null;');
const end=main.indexOf('\n let trashOpen=',start);
assert.ok(start>=0&&end>start,'Report Center PDF toolbar source must be present');
const code=main.slice(start,end);

function mountToolbar(){
 const dom=new JSDOM('<div id="app"><main><section class="report-center"><div id="report-library-list"><button class="report-record" data-kind="walk" data-id="walk-a" data-time="1761242400000"><strong>Daily Report</strong></button><button class="report-record" data-kind="walk" data-id="not-finalized">Unfinished</button></div></section></main></div>',{url:'https://ge-one.example'});
 const doc=dom.window.document;
 const list=doc.querySelector('#report-library-list');
 const archive={id:'arch-01',project_id:'job-one',report_type:'daily_safety_walk',source_id:'walk-a',document_status:'final',pdf_path:'path/a.pdf'};
 const calls=[];
 const ctx=vm.createContext({
  document:doc,list,
  archivedPdfs:new Map([['daily_safety_walk:walk-a',archive]]),
  tr:en=>en,state:{project:'job-one'},viewCurrent:()=>true,
  readyArchivedPdf:null,
  reservePdfDestination:()=>({kind:'system'}),
  archivedPdfFilename:()=> 'Daily Report 10.23.2026 By G&E.pdf',
  db:{storage:{from:()=>({download:async()=>({data:new Blob(['%PDF-1.4\n'+'PDF '.repeat(15)+'\n%%EOF'],{type:'application/pdf'}),error:null})})}},
  win:dom.window,window:dom.window,
  navigator:dom.window.navigator,File:dom.window.File,
  openArchivedPdf:async()=>{calls.push('view')},
  downloadArchivedPdf:async()=>{calls.push('download')},
  archivedPdfLink:async()=>{calls.push('signed')},
  isValidPdfBlob:async()=>true,
  fileShareSupported:()=>false,
  savePdfToDevice:async()=>{calls.push('save');return{kind:'saved'}},
  downloadReportPdf:()=>calls.push('download-fallback'),
  confirmAction:()=>calls.push('confirm'),
  error:e=>{throw e}
 });
 vm.runInContext(code+'\ndecorateFinalPdfShortcuts();',ctx);
 return {dom,doc,list,calls,ctx};
}

test('Report Center places the three finalized PDF controls in a single semantic toolbar',()=>{
 const t=mountToolbar();
 const row=t.list.querySelector('[data-id="walk-a"]');
 const group=row.nextElementSibling;
 assert.equal(group.className,'final-pdf-shortcuts');
 assert.equal(group.getAttribute('role'),'group');
 assert.match(group.getAttribute('aria-label'),/PDF/);
 assert.match(group.querySelector('.final-pdf-shortcuts-title').textContent,/SAVED FINAL PDF/);
 assert.ok(group.querySelector('.final-pdf-shortcuts-hint'));
 const buttons=[...group.querySelectorAll('button')];
 assert.deepEqual(buttons.map(b=>b.dataset.pdfAction),['view','download','save']);
 assert.deepEqual(buttons.map(b=>b.getAttribute('aria-label')),['View saved PDF','Download saved PDF','Save PDF to…']);
 assert.deepEqual(buttons.map(b=>b.querySelector('.final-pdf-shortcut-label').textContent),['View PDF','Download PDF','Save PDF to…']);
 assert.ok(buttons.every(button=>button.querySelector('[aria-hidden="true"]')&&button.querySelector('.final-pdf-shortcut-label')));
 assert.equal(t.list.querySelector('[data-id="not-finalized"]').nextElementSibling,null,'Do not add saved-PDF actions to unfinished reports');
 t.dom.window.close();
});

test('PDF toolbar visually organizes desktop, tablet, phone, and tiny screens',()=>{
 for(const part of [
  '.final-pdf-actions-grid','grid-template-columns:repeat(3,minmax(0,1fr))',
  '@media(max-width:700px)','grid-template-columns:repeat(2,minmax(0,1fr))',
  '.final-pdf-shortcut--save','grid-column:1/-1',
  '@media(max-width:390px)','grid-template-columns:minmax(0,1fr)',
  'min-height:42px','min-height:44px',
  'max-width:630px','max-width:220px','padding:7px 9px',
  '.final-pdf-shortcut:focus-visible','@media(prefers-reduced-motion:reduce)',
  '.report-record[style*="display: none"]+.final-pdf-shortcuts',
  '@media print'
 ])assert.ok(styles.includes(part),'Missing safe mobile/tablet styling: '+part);
 assert.doesNotMatch(styles,/(?:article\.report|\.professional-report|\.print-report)\s*\{/,'Printable PDFs must not be restyled');
});

test('View, Download, and Save retain existing direct-PDF actions and do not open the report row',async()=>{
 const t=mountToolbar();
 const bar=t.list.querySelector('.final-pdf-shortcuts');
 const actions=[...bar.querySelectorAll('button')];
 let opens=0;
 t.list.querySelector('.report-record').addEventListener('click',()=>opens++);
 await actions[0].onclick();
 await actions[1].onclick();
 await actions[2].onclick();
 assert.deepEqual(t.calls,['view','download','confirm','signed','save','confirm']);
 assert.equal(opens,0,'Saved PDF controls should not navigate the source report');
 assert.ok(actions.every(b=>!b.disabled),'All buttons must unlock after operation');
 assert.equal(actions[2].querySelector('.final-pdf-shortcut-label').textContent,'Save PDF now');
 t.dom.window.close();
});

test('toolbar cannot duplicate on repaint or start a PDF action for another project',async()=>{
 const t=mountToolbar();
 vm.runInContext('decorateFinalPdfShortcuts();',t.ctx);
 assert.equal(t.list.querySelectorAll('.final-pdf-shortcuts').length,1);
 t.ctx.state.project='job-two';
 const action=t.list.querySelector('.final-pdf-shortcut--download');
 await action.onclick();
 assert.deepEqual(t.calls,[]);
 t.dom.window.close();
});
