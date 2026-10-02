import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
const fn=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end)};
function setup(name,{queryError,missingPhoto=false}={}){
 const frames=[],errors=[],requested=[];
 const record={id:'record',project_id:'job',photos:[{path:'first'},{path:'second'}],items:[{photos:[{path:'first'}]}],photo_path:'first'};
 const tables={equipmentInspectionReport:'equipment_inspections',disciplineReport:'safety_discipline',observationReport:'observations',safetyWalkReport:'daily_safety_walks',inventoryReport:'inventory_items'};
 const db={from(table){const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},single(){return q},then(resolve,reject){return Promise.resolve({data:table===tables[name]?(name==='inventoryReport'?[record]:record):table==='observation_photos'?[{path:'first',kind:'before'}]:[],error:table===queryError?Error('Evidence query offline'):null}).then(resolve,reject)}};return q}};
 const context=vm.createContext({db,state:{detail:'record',project:'job',projects:[{id:'job'}],profile:{id:'owner',name:'Safety'},lang:'en'},captureView:()=>()=>true,error:e=>errors.push(e.message),frame:html=>frames.push(html),signedDisplayImage:async(_,path)=>{requested.push(path);return missingPhoto?'':'blob:'+path},tr:x=>x,localDateKey:()=> '2026-10-02',esc:x=>x,fmt:x=>x,reportSignaturesReport:()=>'',Intl});
 vm.runInContext(fn(name),context);return {context,frames,errors,requested};
}
for(const name of ['equipmentInspectionReport','disciplineReport','observationReport','safetyWalkReport','inventoryReport'])test(`${name} refuses to silently omit a saved evidence photo`,async()=>{
 const t=setup(name,{missingPhoto:true});await assert.rejects(t.context[name](),/evidence photo could not be loaded/);assert.equal(t.frames.length,0);assert.ok(t.requested.length);
});
for(const table of ['observation_photos','corrective_actions'])test(`observation report surfaces ${table} failure before displaying a final report`,async()=>{
 const t=setup('observationReport',{queryError:table});await t.context.observationReport();assert.deepEqual(t.errors,['Evidence query offline']);assert.equal(t.frames.length,0);
});
