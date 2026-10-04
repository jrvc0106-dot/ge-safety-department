import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {parseAst} from 'rollup/parseAst';
import {effectiveWalkStatus} from '../src/daily-walk-report-status.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(source);
const reportNode=ast.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='safetyWalkReport');
const reportSource=source.slice(reportNode.start,reportNode.end);

function makeReportContext(){
  const items=Array.from({length:8},(_,i)=>({
    sort_order:i,
    status:'unsafe',
    category:`Hazard ${i+1}`,
    item_text:`Checklist item ${i+1}`,
    hazard:`Finding ${i+1}`,
    correction:`Corrective action ${i+1}`,
    photos:[{path:`photo-${i+1}`}]
  }));
  const record={
    id:'jha-report-123456',project_id:'project-1',created_at:'2026-10-01T14:00:00.000Z',
    overall_status:'unsafe',items,notes:'',weather_snapshot:null,approvals:null,
    creator:{name:'Safety Inspector',email:'safety@example.com'}
  };
  const frames=[];
  const db={from(table){
    const query={select(){return query},eq(){return query},order(){return query},limit(){return query},single(){return query},then(resolve,reject){
      const result=table==='daily_safety_walks'?{data:record,error:null}:{data:[{version:0}],error:null};
      return Promise.resolve(result).then(resolve,reject);
    }};
    return query;
  }};
  const context=vm.createContext({
    db,
    effectiveWalkStatus,
    state:{detail:record.id,project:record.project_id,projects:[{id:record.project_id,name:'Test Project',address:'Test Site'}],profile:{id:'inspector'},lang:'en'},
    captureView:()=>()=>true,
    signedDisplayImage:async(_bucket,path)=>`data:image/jpeg;base64,${path}`,
    frame:html=>frames.push(html),
    document:{querySelector:()=>({})},
    tr:english=>english,
    esc:value=>String(value??''),
    localDateKey:()=> '2026-10-01',
    fmt:value=>String(value??''),
    weatherCodeLabel:()=>'',
    back:()=>{},
    clearDraft:async()=>{},
    navigate:()=>{},
    Intl
  });
  vm.runInContext(reportSource,context);
  return {context,frames};
}

test('JHA evidence and hazard photos paginate six per page without losing finding/action text',async()=>{
  const {context,frames}=makeReportContext();
  await context.safetyWalkReport();
  assert.equal(frames.length,1);

  const dom=new JSDOM(frames[0]);
  const report=dom.window.document.querySelector('article.ge-reference-jha');
  assert.ok(report);
  const pages=[...report.querySelectorAll('.ewr-photo-page[data-jha-pdf-page]')];
  const register=pages.filter(page=>page.querySelector('.ewr-photo-register-title'));
  const hazards=pages.filter(page=>page.querySelector('.ewr-hazard-photo-card'));
  const groupSizes=groups=>groups.map(page=>page.querySelectorAll('.ewr-photo-card').length);

  assert.deepEqual(groupSizes(register),[6,2]);
  assert.deepEqual(groupSizes(hazards),[6,2]);
  for(let i=1;i<=8;i++){
    assert.ok(report.textContent.includes(`Finding ${i}`));
    assert.ok(report.textContent.includes(`Corrective action ${i}`));
  }
});

test('JHA photo frames override global natural-height PDF image rules without cropping',()=>{
  const dom=new JSDOM('<article class="report ge-reference-jha"><section class="ewr-photo-page"><figure class="ewr-photo-card"><img></figure></section></article>');
  const style=dom.window.document.createElement('style');
  style.textContent=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
  dom.window.document.head.append(style);
  const image=dom.window.document.querySelector('img');
  const computed=dom.window.getComputedStyle(image);
  assert.equal(computed.height,'175px');
  assert.equal(computed.maxHeight,'175px');
  assert.equal(computed.objectFit,'contain');
  assert.equal(computed.objectPosition,'center');
});
