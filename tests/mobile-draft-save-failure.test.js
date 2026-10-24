import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {JSDOM} from 'jsdom';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
const fn=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='persistDraft');
if(!fn)throw Error('Cannot locate GE ONE persistent draft save function');
const code=source.slice(fn.start,fn.end);

function fixture({online=false,cloudError=true,localFails=true}={}){
 const dom=new JSDOM('<form id="walk-form"><textarea name="notes">Fresh work</textarea></form>');
 const form=dom.window.document.querySelector('form');
 form.dataset.autoDraft='true';
 const statuses=[],calls=[];
 const ctx=vm.createContext({
  navigator:{onLine:online},document:dom.window.document,
  draftOwner:()=>({user:'safety',project:'job'}),
  formDraftKey:()=> 'safety:job:daily_safety_walk:default',
  draftLocalTimers:new Map(),draftWrites:new Map(),
  serializeDraftForm:()=>({notes:'Fresh work'}),
  localStorage:{setItem:()=>{if(localFails)throw Error('QuotaExceededError')}},
  setDraftStatus:(_form,msg,kind)=>statuses.push({msg,kind}),
  tr:en=>en,clearTimeout:()=>{},db:{from:()=>({upsert:async()=>{calls.push('upsert');return{error:cloudError?Error('Connection lost'):null}}})}
 });
 vm.runInContext(code,ctx);
 return {dom,form,ctx,statuses,calls};
}

test('airplane mode and full iPhone storage cause a visible error instead of claiming draft saved',async()=>{
 const t=fixture({online:false,localFails:true});
 try{
  await assert.rejects(t.ctx.persistDraft(t.form,'daily_safety_walk'),/could not be stored/);
  assert.equal(t.statuses.at(-1).kind,'error');
  assert.match(t.statuses.at(-1).msg,/NOT saved/);
  assert.equal(t.calls.length,0);
 }finally{t.dom.window.close()}
});

test('phone warns when both local and cloud persistence fail',async()=>{
 const t=fixture({online:true,cloudError:true,localFails:true});
 try{
  await assert.rejects(t.ctx.persistDraft(t.form,'daily_safety_walk'),/locally or in the cloud/);
  assert.equal(t.statuses.at(-1).kind,'error');
  assert.equal(t.calls.length,1);
 }finally{t.dom.window.close()}
});

test('confirmed cloud draft is still saved when Safari denies localStorage',async()=>{
 const t=fixture({online:true,cloudError:false,localFails:true});
 try{
  await t.ctx.persistDraft(t.form,'daily_safety_walk');
  assert.equal(t.statuses.at(-1).kind,'saved');
  assert.equal(t.calls.length,1);
 }finally{t.dom.window.close()}
});
