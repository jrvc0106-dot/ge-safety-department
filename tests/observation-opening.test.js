import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {parseAst} from 'rollup/parseAst';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
const fn=name=>{const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(node.start,node.end)};
for(const status of ['open','pending_verification','closed'])test(`observation ${status} opens with separate author, assignee and reviewer references`,async()=>{
 const dom=new JSDOM('<main id="app"></main>'),errors=[],queries=[];
 const observation={id:'obs',project_id:'job',status,priority:'high',area:'Floor 5',category:'Fall protection',description:'Guardrail requires repair',created_at:'2026-10-07'};
 const db={from(table){let selection='';const q={select(value){selection=value;queries.push({table,selection});return q},eq(){return q},order(){return q},then(resolve,reject){const ambiguous=table==='corrective_actions'&&selection.includes('author:profiles(name)');return Promise.resolve({error:ambiguous?{code:'PGRST201',message:'More than one relationship between corrective_actions and profiles'}:null,data:table==='corrective_actions'?[{id:'action',comment:'Repair rail',status:'pending_review',author:{name:'Safety author'},assignee:{name:'Foreman owner'}}]:[]}).then(resolve,reject)}};return q}};
 const context=vm.createContext({db,state:{project:'job',detail:'obs',profile:{id:'safety',role:'safety'},observations:[observation]},document:dom.window.document,frame:html=>dom.window.document.querySelector('#app').innerHTML=html,captureView:()=>()=>true,error:err=>errors.push(err),esc:value=>String(value??''),tr:en=>en,fmt:value=>value,localDateKey:()=> '2026-10-07',back(){},mountReportSignatures(){}});
 vm.runInContext(fn('detail'),context);await context.detail();
 assert.equal(queries.filter(q=>q.table==='project_members').length,status==='open'?1:0,'members load only when a correction can be submitted');
 assert.deepEqual(errors,[]);assert.match(dom.window.document.body.textContent,/Floor 5/);assert.match(dom.window.document.body.textContent,/Safety author/);assert.match(dom.window.document.body.textContent,/Foreman owner/);
 assert.ok(queries.find(q=>q.table==='corrective_actions').selection.includes('author:profiles!corrective_actions_created_by_fkey(name)'));
});
