import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
const fn=name=>{const n=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(n.start,n.end)};
function setup(files=[],draftFails=false){
 const writes=[],uploads=[],errors=[],redirects=[],button={disabled:false},form={dataset:{},querySelector:()=>button};
 const state={project:'original-job',profile:{id:'owner'},page:'inventory'};
 const db={from(table){const q={insert(payload){writes.push({table,payload});return q},update(){return q},delete(){return q},eq(){return q},select(){return q},single:async()=>({data:{id:'item'},error:null}),then(resolve,reject){return Promise.resolve({error:null}).then(resolve,reject)}};return q},storage:{from:()=>({upload:async path=>{uploads.push(path);return {error:null}},remove:async()=>({error:null})})}};
 const context=vm.createContext({state,db,document:{querySelector:()=>form},captureView:()=>()=>state.project==='original-job',frame(){},simplifyInventoryForm(){},tr:x=>x,esc:x=>x,INVENTORY_CATEGORIES:{tools:{}},inventoryLabel:x=>x,FormData:class{get(name){return {category:'tools',item_name:'Hammer',quantity:'1',condition:'good',status:'active',assigned_to:'Team'}[name]||''}},draftFilesFor:async(_,__,___,name)=>{if(draftFails)throw Error('Draft unavailable');return name==='photos'?files:[]},normalizeReportImage:async file=>file,crypto:{randomUUID:()=> 'uuid'},clearDraft:async()=>{},confirmAction(){},navigate:(...args)=>redirects.push(args),error:err=>errors.push(err.message),console});
 vm.runInContext(fn('inventoryItemForm'),context);context.inventoryItemForm();
 return {context,state,form,button,writes,uploads,errors,redirects,submit:()=>form.onsubmit({preventDefault(){}})};
}
for(const file of [{size:0,type:'image/jpeg',name:'empty.jpg'},{size:10485761,type:'image/jpeg',name:'large.jpg'},{size:12,type:'application/pdf',name:'wrong.pdf'}]){
 test('invalid inventory evidence does not create an item: '+file.name,async()=>{const t=setup([file]);await t.submit();assert.equal(t.writes.length,0);assert.equal(t.uploads.length,0);assert.equal(t.errors.length,1);assert.equal(t.button.disabled,false);assert.equal(t.form.dataset.submitting,undefined)});
}
test('unavailable draft evidence does not create an inventory item',async()=>{const t=setup([],true);await t.submit();assert.equal(t.writes.length,0);assert.deepEqual(t.errors,['Draft unavailable']);assert.equal(t.button.disabled,false)});
test('inventory still saves without optional photos',async()=>{const t=setup();await t.submit();assert.equal(t.writes[0].table,'inventory_items');assert.equal(t.writes[0].payload.project_id,'original-job');assert.deepEqual(t.errors,[]);assert.equal(t.uploads.length,0);assert.deepEqual(t.redirects,[['inventory']])});
test('valid inventory photos remain linked to the created item',async()=>{const t=setup([{size:12,type:'image/jpeg',name:'photo.jpg'}]);await t.submit();assert.deepEqual(t.errors,[]);assert.equal(t.uploads[0],'original-job/item/uuid.jpeg');assert.equal(t.writes.find(x=>x.table==='inventory_item_photos').payload.inventory_item_id,'item')});
test('inventory report surfaces photo query errors instead of rendering missing evidence',async()=>{
 const errors=[],frames=[];const state={project:'job',profile:{name:'Safety'},projects:[]};
 const context=vm.createContext({state,captureView:()=>()=>true,localDateKey:()=> '2026-09-30',error:e=>errors.push(e.message),frame:html=>frames.push(html),db:{from:table=>{const q={select(){return q},eq(){return q},order(){return q},in(){return q},then(resolve,reject){return Promise.resolve(table==='inventory_items'?{data:[{id:'one',quantity:1}],error:null}:{data:null,error:Error('Photos unavailable')}).then(resolve,reject)}};return q}}});
 vm.runInContext(fn('inventoryReport'),context);await context.inventoryReport();assert.deepEqual(errors,['Photos unavailable']);assert.equal(frames.length,0);
});
