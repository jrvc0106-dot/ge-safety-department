import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {showTodayPrioritiesObservations} from '../src/today-priorities-observations.js';

function setup({rows=[],error=null}={}) {
  const dom=new JSDOM('<main><section class="command-center"><div class="command-grid">Indicators stay</div></section><section class="home-open-observations"><div class="home-open-heading"><div><strong>Open Observations</strong><small>Current project</small></div><button id="home-open-all"></button></div><div class="home-open-list"></div></section></main>');
  const calls=[],opened=[],state={project:'project-a',projects:[{id:'project-a',name:'First jobsite'},{id:'project-b',name:'Domus2'}],session:{user:{id:'safety'}}};
  const query={select(value){calls.push(['select',value]);return this},in(key,values){calls.push(['in',key,values]);return this},order(){return this},limit(){return Promise.resolve({data:rows,error})}};
  const db={from(table){calls.push(['from',table]);return query}};
  let current=true;
  showTodayPrioritiesObservations({
    db,state,tr:en=>en,fmt:()=> 'Oct 17',
    openObservation:id=>opened.push(id),
    loadProjectObservations:async projectId=>calls.push(['load',projectId]),
    isCurrent:()=>current,
    documentRef:dom.window.document,
    reportError:e=>{throw e}
  });
  return {document:dom.window.document,state,calls,opened,setCurrent:value=>{current=value}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('Today priorities includes unresolved observations across authorized jobsites and preserves four indicators',async()=>{
  const view=setup({rows:[
    {id:'a',project_id:'project-a',status:'open',priority:'low',description:'Low hazard',area:'Roof'},
    {id:'b',project_id:'project-b',status:'open',priority:'medium',description:'Guardrail issue',area:'Floor 5'},
    {id:'c',project_id:'project-b',status:'pending_verification',priority:'high',description:'Correction review',area:'Floor 6'}
  ]});
  await tick();
  const panel=view.document.querySelector('.command-center');
  assert.equal(panel.querySelector('.command-grid').textContent,'Indicators stay');
  assert.ok(panel.contains(view.document.querySelector('.home-open-observations')));
  const buttons=[...view.document.querySelectorAll('.home-open-row')];
  assert.deepEqual(buttons.map(b=>b.querySelector('b').textContent),['Correction review','Guardrail issue','Low hazard']);
  assert.match(buttons[0].textContent,/Waiting Safety review/);
  assert.match(buttons[1].textContent,/Domus2/);
  assert.match(view.document.querySelector('.home-open-heading strong').textContent,/\(3\)/);
  assert.deepEqual(view.calls.filter(c=>c[0]==='in'&&c[1]==='status')[0][2],['open','pending_verification']);
  buttons[1].click();
  await tick();
  assert.equal(view.state.project,'project-b');
  assert.deepEqual(view.calls.filter(c=>c[0]==='load'),[['load','project-b']]);
  assert.deepEqual(view.opened,['b']);
});

test('Today priorities leaves closed cases off the pending list when there are none',async()=>{
  const view=setup({rows:[]});
  await tick();
  assert.equal(view.document.querySelectorAll('.home-open-row').length,0);
  assert.match(view.document.querySelector('.home-open-empty').textContent,/No pending observations/);
  assert.equal(view.calls.some(c=>['update','insert','delete'].includes(c[0])),false);
});

test('An expired home view does not display results from an old jobsite',async()=>{
  let finish;
  const dom=new JSDOM('<section class="command-center"></section><section class="home-open-observations"><div class="home-open-heading"><strong>Open</strong><small></small></div><div class="home-open-list"></div></section>');
  const state={project:'A',projects:[{id:'A',name:'Jobsite A'}],session:{user:{id:'u'}}};
  const db={from(){const q={select(){return q},in(){return q},order(){return q},limit(){return new Promise(resolve=>{finish=resolve})}};return q}};
  let valid=true;
  showTodayPrioritiesObservations({db,state,tr:en=>en,fmt:String,openObservation(){},loadProjectObservations(){},isCurrent:()=>valid,documentRef:dom.window.document,reportError(){}});
  valid=false;finish({data:[{id:'x',project_id:'A',status:'open',priority:'high'}],error:null});
  await tick();
  assert.equal(dom.window.document.querySelectorAll('.home-open-row').length,0);
});
