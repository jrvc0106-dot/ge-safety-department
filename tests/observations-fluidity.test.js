import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {parseAst} from 'rollup/parseAst';
import {isOverdueDate} from '../src/field-operations.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
const fn=name=>{const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(node.start,node.end)};
function setup(){
 const dom=new JSDOM('<main id="app"></main>'),document=dom.window.document,views=[],routes=[];let formatted=0;
 const rows=[
  {id:'open',status:'open',due_date:'2026-10-08',priority:'high',area:'Floor 5',category:'Falls',description:'Guardrail',assignee:{name:'Alex'}},
  {id:'review',status:'pending_verification',due_date:'2026-10-09',priority:'medium',area:'Basement',category:'Equipment',description:'Forklift'},
  {id:'closed',status:'closed',due_date:'2026-10-01',priority:'low',area:'Ground',category:'Housekeeping',description:'Waste removed'}
 ];
 const context=vm.createContext({state:{observations:rows,profile:{id:'safety'}},document,frame:html=>document.querySelector('#app').innerHTML=html,esc:value=>String(value??''),tr:en=>en,fmt:()=>{formatted++;return 'Oct 7'},captureView:()=>()=>true,isOverdueDate,localDateKey:()=> '2026-10-09',markViewed:async id=>views.push(id),navigate:(...args)=>routes.push(args)});
 vm.runInContext(fn('summarizeDashboardObservations')+'\n'+fn('openObservation')+'\n'+fn('observationsList'),context);context.observationsList();
 return {document,dom,views,routes,context,state:context.state,get formatted(){return formatted}};
}
const visible=t=>[...t.document.querySelectorAll('.obs-card')].filter(card=>!card.hidden).map(card=>card.dataset.id);
test('search and combined filters reuse cards, preserve order and retain the no-results message',()=>{
 const t=setup(),cards=[...t.document.querySelectorAll('.obs-card')],search=t.document.querySelector('#obs-search'),priority=t.document.querySelector('#obs-priority');
 assert.deepEqual(visible(t),['open','review','closed']);assert.equal(t.document.querySelector('.empty-state').hidden,true);
 search.value='  ALEX ';search.oninput();assert.deepEqual(visible(t),['open']);
 search.value='';search.oninput();priority.value='medium';priority.onchange();assert.deepEqual(visible(t),['review']);
 t.document.querySelector('[data-status="closed"]').click();assert.deepEqual(visible(t),[]);assert.equal(t.document.querySelector('.empty-state').hidden,false);
 priority.value='all';priority.onchange();assert.deepEqual(visible(t),['closed']);
 t.document.querySelector('[data-status="all"]').click();assert.deepEqual(visible(t),['open','review','closed']);
 cards.forEach((card,index)=>assert.equal(t.document.querySelectorAll('.obs-card')[index],card));
 assert.equal(t.formatted,3,'filtering does not reformat dates or rebuild card contents');
});
test('a nested card click records the view and opens the correct observation',async()=>{
 const t=setup();await t.document.querySelector('#obs-list').onclick({target:t.document.querySelector('[data-id="review"] h3')});
 assert.deepEqual(t.views,['review']);assert.deepEqual(t.routes,[['detail','review']]);
 t.document.querySelector('#obs-new').click();assert.deepEqual(t.routes[1],['new']);
});
test('hidden cards and the no-results message cannot open an observation',async()=>{
 const t=setup(),list=t.document.querySelector('#obs-list'),search=t.document.querySelector('#obs-search');search.value='no such observation';search.oninput();
 await list.onclick({target:t.document.querySelector('.obs-card h3')});await list.onclick({target:t.document.querySelector('.empty-state strong')});assert.deepEqual(t.routes,[]);assert.deepEqual(t.views,[]);
});
test('opening starts immediately while a slow view receipt is still saving',async()=>{
 let resolveReceipt;const gate=new Promise(resolve=>resolveReceipt=resolve),routes=[];
 const state={project:'job',profile:{id:'safety'}};
 const context=vm.createContext({state,markViewed:()=>gate,navigate:(...args)=>routes.push(args),console});
 vm.runInContext(fn('openObservation'),context);context.openObservation('obs');
 assert.deepEqual(routes,[['detail','obs']]);assert.equal(state.observationViewReceipt.id,'obs');assert.equal(state.observationViewReceipt.userId,'safety');assert.equal(state.observationViewReceipt.projectId,'job');
 resolveReceipt();await new Promise(setImmediate);assert.equal(state.observationViewReceipt,undefined);
});
test('details load evidence in parallel with the receipt and display the saved Viewed by history',async()=>{
 let resolveReceipt;const gate=new Promise(resolve=>resolveReceipt=resolve),queried=[],frames=[];
 const db={from(table){queried.push(table);const q={select(){return q},eq(){return q},order(){return q},then(resolve,reject){return Promise.resolve({data:table==='observation_views'?[{profile:{name:'Current Safety'},last_viewed_at:'now'}]:[],error:null}).then(resolve,reject)}};return q}};
 const dom=new JSDOM('<main id="app"></main>'),state={project:'job',detail:'obs',profile:{id:'safety'},observations:[{id:'obs',project_id:'job',status:'closed'}]};
 const context=vm.createContext({db,state,document:dom.window.document,captureView:()=>()=>true,frame:html=>{frames.push(html);dom.window.document.querySelector('#app').innerHTML=html},tr:en=>en,esc:value=>String(value??''),fmt:value=>value,back(){}});
 vm.runInContext(fn('detail'),context);
 const loading=context.detail({id:'obs',projectId:'job',userId:'safety',promise:gate});await new Promise(setImmediate);
 assert.ok(queried.includes('observation_photos'));assert.ok(queried.includes('corrective_actions'));assert.equal(queried.includes('observation_views'),false);assert.equal(frames.length,0);
 resolveReceipt();await loading;assert.equal(queried.includes('observation_views'),true);assert.equal(frames.length,1);assert.match(frames[0],/Current Safety/);
});

test('returning to observations restores search, priority, status and scroll position',()=>{
 const t=setup(),callbacks=[],scrolls=[];t.dom.window.requestAnimationFrame=callback=>callbacks.push(callback);t.dom.window.scrollTo=(x,y)=>scrolls.push(y);
 const search=t.document.querySelector('#obs-search'),priority=t.document.querySelector('#obs-priority');search.value='Alex';search.oninput();priority.value='high';priority.onchange();t.document.querySelector('[data-status="open"]').click();
 Object.defineProperty(t.dom.window,'scrollY',{value:620,configurable:true});
 t.document.querySelector('#obs-new').click();t.document.querySelector('#app').innerHTML='<p>Detail</p>';
 Object.defineProperty(t.dom.window,'scrollY',{value:0,configurable:true});t.context.observationsList();callbacks.shift()();
 assert.equal(t.document.querySelector('#obs-search').value,'Alex');assert.equal(t.document.querySelector('#obs-priority').value,'high');assert.equal(t.document.querySelector('[data-status="open"]').classList.contains('active'),true);assert.deepEqual(visible(t),['open']);assert.deepEqual(scrolls,[620]);
});
test('filters are separate for each project and cleared for another employee',()=>{
 const t=setup();t.state.project='job-a';t.context.observationsList();let search=t.document.querySelector('#obs-search');search.value='Alex';search.oninput();
 t.state.project='job-b';t.context.observationsList();assert.equal(t.document.querySelector('#obs-search').value,'');search=t.document.querySelector('#obs-search');search.value='Basement';search.oninput();
 t.state.project='job-a';t.context.observationsList();assert.equal(t.document.querySelector('#obs-search').value,'Alex');assert.deepEqual(visible(t),['open']);
 t.state.profile={id:'another-employee'};t.context.observationsList();assert.equal(t.document.querySelector('#obs-search').value,'');assert.deepEqual(visible(t),['open','review','closed']);
});
test('a delayed scroll restoration cannot move another screen',()=>{
 const t=setup(),callbacks=[],scrolls=[];t.dom.window.requestAnimationFrame=callback=>callbacks.push(callback);t.dom.window.scrollTo=(x,y)=>scrolls.push(y);t.context.observationsList();t.document.querySelector('#app').innerHTML='<p>Another screen</p>';callbacks.shift()();assert.deepEqual(scrolls,[]);
});

test('overdue filter shows only active observations whose local due date has passed',()=>{
 const t=setup();
 t.document.querySelector('[data-status="overdue"]').click();
 assert.deepEqual(visible(t),['open']);
 assert.equal(t.document.querySelector('.summary-chip.overdue strong').textContent,'1');
 assert.match(t.document.querySelector('.obs-card[data-id="open"] .obs-due').textContent,/OVERDUE/);
});
