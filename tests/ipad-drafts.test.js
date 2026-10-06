import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
test('rapid tablet input batches local writes and pagehide saves the latest edit immediately',async()=>{
 const dom=new JSDOM('<form id="incident-form"><textarea name="notes"></textarea></form>');
 const writes=[],timers=new Map();let id=0;
 const context=vm.createContext({document:dom.window.document,window:dom.window,state:{profile:{id:'safety'},project:'job'},
  localStorage:{setItem:(key,value)=>writes.push(JSON.parse(value))},tr:x=>x,
  setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id},clearTimeout:id=>timers.delete(id),
  db:{from:()=>({upsert:async()=>({error:null})})}});
 vm.runInContext(source.slice(source.indexOf('const DRAFT_FORMS='),source.indexOf('const optionalScriptLoads=')),context);
 context.restoreDraft=async()=>false;
 const form=dom.window.document.querySelector('form'),field=form.elements.notes;
 await context.enableAutoDraft(form,'incident');
 for(let i=0;i<100;i++){field.value='note '+i;field.dispatchEvent(new dom.window.Event('input',{bubbles:true}))}
 assert.equal(writes.length,0);assert.equal([...timers.values()].filter(x=>x.delay===80).length,1);
 const [localId,local]=[...timers].find(([,x])=>x.delay===80);timers.delete(localId);local.fn();
 assert.equal(writes.length,1);assert.equal(writes[0].payload.notes,'note 99');
 field.value='last edit before locking iPad';field.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 dom.window.dispatchEvent(new dom.window.Event('pagehide'));
 assert.equal(writes.at(-1).payload.notes,field.value);
 assert.equal([...timers.values()].filter(x=>x.delay===80).length,0);
 dom.window.close();
});
