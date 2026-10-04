import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function setup(){
 const requests=[],resolve={},filters=[];
 const state={session:{user:{id:'user'}},profile:null,projects:[],observations:[],project:'original'};
 const db={from(table){const query={select(){return this},eq(key,value){filters.push({table,key,value});return this},order(){return this},maybeSingle(){return this},then(done){requests.push(table);return new Promise(r=>resolve[table]=r).then(done)}};return query}};
 const context=vm.createContext({state,db});
 vm.runInContext(source.slice(source.indexOf('const projectObservationsCache='),source.indexOf('\nfunction nav()')),context);
 return {context,state,requests,resolve,filters};
}
test('dashboard loads observations only after selecting the active project',async()=>{
 const t=setup(),loading=t.context.load();await Promise.resolve();
 assert.deepEqual(t.requests,['profiles','projects']);
 t.resolve.profiles({data:{id:'user'}});t.resolve.projects({data:[{id:'original'},{id:'other'}]});await new Promise(setImmediate);
 assert.deepEqual(t.requests,['profiles','projects','observations']);
 assert.ok(t.filters.some(f=>f.table==='observations'&&f.key==='project_id'&&f.value==='original'));
 t.resolve.observations({data:[{id:'observation',project_id:'original'}]});
 await loading;assert.equal(t.state.project,'original');assert.equal(t.state.observations[0].id,'observation');
});
test('responses from a previous session cannot populate the current dashboard',async()=>{
 const t=setup(),loading=t.context.load();await Promise.resolve();t.state.session=null;
 for(const table of t.requests)t.resolve[table]({data:table==='profiles'?{id:'user'}:[]});
 await loading;assert.equal(t.state.profile,null);assert.equal(t.state.projects.length,0);
});
test('dashboard observation counters are calculated in one pass with existing status rules',()=>{
 const start=source.indexOf('function summarizeDashboardObservations('),end=source.indexOf('\nfunction home()',start),context=vm.createContext({});
 vm.runInContext(source.slice(start,end),context);
 const counts=context.summarizeDashboardObservations([{status:'open',priority:'high',assigned_to:'user'},{status:'pending_verification',priority:'medium',assigned_to:'other'},{status:'closed',priority:'high',assigned_to:'user'}],'user');
 assert.deepEqual({...counts},{open:1,pending:1,closed:1,highOpen:1,myOpen:1});
});
test('late observation response from the previous project cannot replace active project data',async()=>{
 const pending=new Map(),filters=[],state={session:{user:{id:'user'}},project:'a',observations:[]},db={from(table){const query={select(){return this},eq(key,value){filters.push({table,key,value});this.project=value;return this},order(){return this},then(done){return new Promise(resolve=>pending.set(this.project,resolve)).then(done)}};return query}},context=vm.createContext({state,db,render(){},error(){}});
 vm.runInContext(source.slice(source.indexOf('const projectObservationsCache='),source.indexOf('\nfunction nav()')),context);
 const previous=context.loadProjectObservations('a');state.project='b';const active=context.loadProjectObservations('b');await new Promise(setImmediate);
 pending.get('b')({data:[{id:'b-row',project_id:'b'}]});await active;pending.get('a')({data:[{id:'a-row',project_id:'a'}]});await previous;
 assert.deepEqual(state.observations.map(row=>row.id),['b-row']);assert.deepEqual(filters.map(item=>item.value),['a','b']);
});
test('date formatting remains identical in both languages while reusing formatters',()=>{
 const state={lang:'en'},context=vm.createContext({state,Intl,Date});
 vm.runInContext(source.slice(source.indexOf('const dateFormatters='),source.indexOf('const localDateKey='))+'\nglobalThis.formatDate=fmt;globalThis.formatterCount=()=>dateFormatters.size;',context);
 for(const lang of ['en','es']){state.lang=lang;const value='2026-09-30T19:00:00Z';const expected=new Intl.DateTimeFormat(lang==='es'?'es-US':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));for(let i=0;i<100;i++)assert.equal(context.formatDate(value),expected)}
 assert.equal(context.formatterCount(),2);assert.equal(context.formatDate(null),'');
});
