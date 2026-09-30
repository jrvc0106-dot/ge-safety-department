import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function setup(){
 const requests=[],resolve={};
 const state={session:{user:{id:'user'}},profile:null,projects:[],observations:[],project:'original'};
 const db={from(table){const query={select(){return this},eq(){return this},order(){return this},maybeSingle(){return this},then(done){requests.push(table);return new Promise(r=>resolve[table]=r).then(done)}};return query}};
 const context=vm.createContext({state,db});
 vm.runInContext(source.slice(source.indexOf('async function load(){'),source.indexOf('\nfunction nav()')),context);
 return {context,state,requests,resolve};
}
test('all independent dashboard queries start before the profile response',async()=>{
 const t=setup(),loading=t.context.load();await Promise.resolve();
 assert.deepEqual(t.requests,['profiles','projects','observations']);
 t.resolve.profiles({data:{id:'user'}});t.resolve.projects({data:[{id:'original'}]});t.resolve.observations({data:[{id:'observation'}]});
 await loading;assert.equal(t.state.project,'original');assert.equal(t.state.observations[0].id,'observation');
});
test('responses from a previous session cannot populate the current dashboard',async()=>{
 const t=setup(),loading=t.context.load();await Promise.resolve();t.state.session=null;
 for(const table of t.requests)t.resolve[table]({data:table==='profiles'?{id:'user'}:[]});
 await loading;assert.equal(t.state.profile,null);assert.equal(t.state.projects.length,0);
});
test('date formatting remains identical in both languages while reusing formatters',()=>{
 const state={lang:'en'},context=vm.createContext({state,Intl,Date});
 vm.runInContext(source.slice(source.indexOf('const dateFormatters='),source.indexOf('const localDateKey='))+'\nglobalThis.formatDate=fmt;globalThis.formatterCount=()=>dateFormatters.size;',context);
 for(const lang of ['en','es']){state.lang=lang;const value='2026-09-30T19:00:00Z';const expected=new Intl.DateTimeFormat(lang==='es'?'es-US':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));for(let i=0;i<100;i++)assert.equal(context.formatDate(value),expected)}
 assert.equal(context.formatterCount(),2);assert.equal(context.formatDate(null),'');
});
