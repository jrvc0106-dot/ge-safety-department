import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderProjectAccess} from '../src/project-access.js';

const projectData={
 projects:[{id:'rivage',name:'Rivage',status:'active'},{id:'domus',name:'Domus II',status:'active'},{id:'old-job',name:'Old Job',status:'inactive'}],
 members:[{id:'worker-1',email:'worker@geflcontractors.com',name:'Worker One',role:'worker',position:'Laborer'},{id:'safety-1',email:'safety@geflcontractors.com',name:'Safety One',role:'safety',position:'Safety'},{id:'admin-1',email:'admin@geflcontractors.com',name:'Admin',role:'admin',position:null}],
 memberships:[{user_id:'worker-1',project_id:'rivage'},{user_id:'safety-1',project_id:'rivage'},{user_id:'safety-1',project_id:'domus'}]
};

function setup({confirm=true,role='safety_director',data=projectData}={}){
 const dom=new JSDOM('<main id="app"></main>',{url:'https://app.test'}),calls=[],messages=[];
 dom.window.confirm=()=>confirm;
 const db={async rpc(name,args){calls.push({name,args});if(name==='get_project_access_data')return {data,error:null};if(name==='set_member_project_access')return {data:{ok:true,changed:true},error:null};throw Error('Unexpected RPC '+name)}};
 const dependencies={db,state:{profile:{id:'safety-1',role},projects:[{id:'rivage'}]},frame:html=>{dom.window.document.querySelector('#app').innerHTML=html},tr:(en)=>en,esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),captureView:()=>()=>true,load:async()=>{},navigate:(...args)=>calls.push({navigate:args}),confirmAction:message=>messages.push(message),error:error=>messages.push(error.message),documentRef:dom.window.document,windowRef:dom.window};
 return {dom,calls,messages,dependencies};
}

test('project access shows exact memberships and the all-projects control',async()=>{
 const t=setup();await renderProjectAccess(t.dependencies);
 const worker=t.dom.window.document.querySelector('[data-member-id="worker-1"]');
 assert.equal(worker.querySelector('[data-project-id="rivage"]').checked,true);
 assert.equal(worker.querySelector('[data-project-id="domus"]').checked,false);
 assert.equal(worker.querySelector('[data-project-summary]').textContent,'1 project');
 assert.equal(worker.querySelector('[data-save-access]').disabled,true);
 const safety=t.dom.window.document.querySelector('[data-member-id="safety-1"]');
 assert.equal(safety.querySelector('[data-project-summary]').textContent,'2 projects');
 assert.equal(safety.querySelector('[data-all-projects]').indeterminate,true);
 assert.equal(t.dom.window.document.querySelector('[data-member-role="admin"] [data-project-summary]').textContent,'All projects');
 t.dom.window.close();
});

test('manager can assign one, selected multiple or all projects using the protected RPC',async()=>{
 const t=setup();await renderProjectAccess(t.dependencies);
 const card=t.dom.window.document.querySelector('[data-member-id="worker-1"]'),checks=[...card.querySelectorAll('[data-project-id]')];
 checks[1].checked=true;checks[1].dispatchEvent(new t.dom.window.Event('change'));
 assert.equal(card.querySelector('[data-project-summary]').textContent,'2 projects');
 await card.querySelector('[data-save-access]').click();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(t.calls[0],{name:'get_project_access_data',args:undefined});
 assert.deepEqual(t.calls[1],{name:'set_member_project_access',args:{p_member_id:'worker-1',p_project_ids:['domus','rivage']}});
 assert.equal(card.querySelector('.project-access-status').textContent,'Access saved.');
 const all=card.querySelector('[data-all-projects]');all.checked=true;all.dispatchEvent(new t.dom.window.Event('change'));
 assert.equal(card.querySelector('[data-project-summary]').textContent,'All projects');
 assert.deepEqual(checks.map(input=>input.checked),[true,true,true]);
 t.dom.window.close();
});

test('removing every project requires confirmation and then saves an empty selection',async()=>{
 const t=setup({confirm:false});await renderProjectAccess(t.dependencies);
 const card=t.dom.window.document.querySelector('[data-member-id="worker-1"]');
 card.querySelectorAll('[data-project-id]').forEach(input=>{input.checked=false;input.dispatchEvent(new t.dom.window.Event('change'))});
 await card.querySelector('[data-save-access]').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.calls.some(call=>call.name==='set_member_project_access'),false);
 t.dom.window.confirm=()=>true;
 await card.querySelector('[data-save-access]').click();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(t.calls.at(-1),{name:'set_member_project_access',args:{p_member_id:'worker-1',p_project_ids:[]}});
 t.dom.window.close();
});

test('unauthorized roles are redirected without reading access data',async()=>{
 const t=setup({role:'worker'});await renderProjectAccess(t.dependencies);
 assert.deepEqual(t.calls,[{navigate:['home',null,{replace:true}]}]);
 t.dom.window.close();
});
