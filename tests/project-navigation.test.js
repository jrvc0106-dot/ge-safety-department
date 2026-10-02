import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
const fn=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end)};
function navigation(){
 const drafts=[],history=[],renders=[];
 const state={session:{user:{id:'owner'}},project:'domus',page:'safetyWalkReport',detail:'old-report',projects:[{id:'domus'},{id:'rivage'},{id:'crossings'},{id:'waldorf'}]};
 const context=vm.createContext({state,safetyTools:{stop(){}},flushActiveDrafts:()=>drafts.push(state.project),render:()=>renders.push({project:state.project,page:state.page,detail:state.detail}),history:{replaceState:entry=>history.push(entry),pushState:entry=>history.push(entry)},location:{href:'https://app.invalid/'}});
 vm.runInContext('let restoringHistory=false;'+['navigate','switchProject','restoreProjectHistory'].map(fn).join('\n'),context);
 return {context,state,drafts,history,renders};
}
for(const project of ['rivage','crossings','waldorf'])test(`switching to ${project} saves the old project's draft and clears the old report`,()=>{
 const t=navigation();t.context.switchProject(project);assert.deepEqual(t.drafts,['domus']);assert.equal(t.state.project,project);assert.equal(t.state.page,'home');assert.equal(t.state.detail,null);assert.equal(t.history[0].projectId,project);assert.equal(t.renders.length,1);
});
test('unchanged or unauthorized project selections do not navigate or discard a draft',()=>{
 const t=navigation();t.context.switchProject('domus');t.context.switchProject('not-authorized');assert.equal(t.state.detail,'old-report');assert.equal(t.drafts.length,0);assert.equal(t.renders.length,0);
});
test('browser Back restores the report with its original authorized project',()=>{
 const t=navigation();t.state.project='rivage';t.context.restoreProjectHistory({geSafety:true,projectId:'domus',page:'safetyWalkReport',detail:'original'});assert.equal(t.state.project,'domus');assert.equal(t.state.detail,'original');assert.equal(t.history.length,0);assert.deepEqual(t.drafts,['rivage']);
});
for(const projectId of [undefined,'removed-project'])test(`history without an authorized project (${projectId}) cannot reopen an old report`,()=>{
 const t=navigation();t.context.restoreProjectHistory({geSafety:true,projectId,page:'incidentReport',detail:'other-job-report'});assert.equal(t.state.project,'domus');assert.equal(t.state.page,'home');assert.equal(t.state.detail,null);
});
for(const name of ['equipmentInspectionReport','incidentReportView','safetyWalkReport','disciplineReport','observationReport'])test(`${name} queries the record within the selected project`,async()=>{
 const filters=[];const db={from(table){const q={select(){return q},eq(key,value){filters.push({table,key,value});return q},order(){return q},single(){return q},then(resolve,reject){return Promise.resolve({error:Error('Record unavailable in selected project')}).then(resolve,reject)}};return q}};
 const context=vm.createContext({db,state:{project:'rivage',detail:'domus-record'},captureView:()=>()=>true,error(){},navigate(){}});vm.runInContext(fn(name),context);await context[name]();assert.ok(filters.some(f=>f.key==='project_id'&&f.value==='rivage'));
});
