import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {parseAst} from 'rollup/parseAst';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(source);
const detailNode=ast.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='detail');
const detailSource=source.slice(detailNode.start,detailNode.end);

async function setup(role='admin'){
  const dom=new JSDOM('<main id="app"></main>');
  const document=dom.window.document;
  const observation={id:'obs',project_id:'job',status:'open',priority:'medium',description:'Corrected guardrail',area:'Floor 18',assigned_to:'safety',created_at:'2026-10-07T15:00:00Z'};
  const state={project:'job',detail:'obs',profile:{id:'director',role},observations:[observation]};
  const events=[];
  const tables={
    observation_photos:[],
    observation_views:[],
    corrective_actions:[],
    project_members:[{user_id:'safety',profile:{name:'Assigned Safety'}}]
  };
  const db={
    from(table){
      const query={
        select(){return this},
        eq(){return this},
        order(){return this},
        insert(payload){events.push(['insert',table,payload]);return this},
        update(payload){events.push(['update',table,payload]);return this},
        single(){return Promise.resolve({data:{id:'action-1'},error:null})},
        then(resolve,reject){return Promise.resolve({data:tables[table]||[],error:null}).then(resolve,reject)}
      };
      return query;
    },
    rpc(name,payload){events.push(['rpc',name,payload]);return Promise.resolve({data:true,error:null})}
  };
  const photo=new dom.window.File(['image'],'correction.jpg',{type:'image/jpeg'});
  const ctx=vm.createContext({
    state,document,window:dom.window,File:dom.window.File,FormData:dom.window.FormData,
    db,tr:en=>en,esc:v=>String(v??''),fmt:()=> 'Oct 7',
    frame:html=>document.querySelector('#app').innerHTML=html,
    captureView:()=>()=>true,
    localDateKey:()=> '2026-10-18',
    photoUrl:async()=>({data:{signedUrl:''}}),
    mountReportSignatures:()=>events.push(['signatures']),
    reportApprovals:()=>({director_signature:'provided'}),
    draftFilesFor:async()=>[photo],
    upload:async()=>({id:'photo-1',path:'obs/after.jpg'}),
    clearDraft:async()=>{},
    savedAction:(en,es)=>events.push(['saved',en]),
    load:async()=>{observation.status='closed'},
    error:e=>{throw e},
    back:()=>{},
    console
  });
  vm.runInContext(detailSource,ctx);
  await ctx.detail();
  return {dom,document,state,events,ctx,observation};
}

test('Admin and Safety Director see a close observation button even when correction was not yet recorded',async()=>{
  for(const role of ['admin','safety_director']){
    const t=await setup(role);
    assert.ok(t.document.querySelector('#close-observation-action'),role);
    assert.ok(t.document.querySelector('button[name="close_observation"]'),role);
    assert.ok(t.events.some(event=>event[0]==='signatures'),role);
  }
});

test('Assigned Safety and workers do not see Director direct-close button',async()=>{
  for(const role of ['safety','worker']){
    const t=await setup(role);
    assert.equal(t.document.querySelector('#close-observation-action'),null,role);
    assert.equal(t.document.querySelector('button[name="close_observation"]'),null,role);
    assert.ok(t.document.querySelector('#correction'),role);
  }
});

test('Director close records corrective action then uses the existing verified-review RPC',async()=>{
  const t=await setup('safety_director');
  t.dom.window.confirm=()=>true;
  const form=t.document.querySelector('#correction');
  form.elements.comment.value='Guardrail restored and inspected by the Safety Director';
  form.elements.assigned_to.value='safety';
  form.elements.due_date.value='2026-10-18';
  await form.onsubmit({preventDefault(){},submitter:form.elements.namedItem('close_observation')});
  const operations=t.events.filter(x=>['insert','update','rpc'].includes(x[0]));
  assert.equal(operations[0][0],'insert');
  assert.equal(operations[0][1],'corrective_actions');
  assert.equal(operations[1][0],'update');
  assert.equal(operations[1][1],'observations');
  assert.equal(operations[1][2].status,'pending_verification');
  assert.equal(operations[2][0],'rpc');
  assert.equal(operations[2][1],'review_corrective_action');
  assert.equal(operations[2][2].p_decision,'approved');
  assert.equal(t.events.some(x=>x[0]==='saved'&&/closed successfully/.test(x[1])),true);
});

test('Canceling closure does not create a correction or modify observation status',async()=>{
  const t=await setup('admin');
  t.dom.window.confirm=()=>false;
  const form=t.document.querySelector('#correction');
  await form.onsubmit({preventDefault(){},submitter:form.elements.namedItem('close_observation')});
  assert.equal(t.events.filter(x=>['insert','update','rpc'].includes(x[0])).length,0);
});
