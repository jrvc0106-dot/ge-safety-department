import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {signatureStrokes,jhaSignatureFields,attachJhaSignatures,jhaApprovals,jhaSignaturesReport} from '../src/jha-signatures.js';
const tr=(en)=>en;
function fixture(){
 const dom=new JSDOM('<form>'+jhaSignatureFields(tr)+'</form>'),form=dom.window.document.querySelector('form');
 const ctx={clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};
 for(const canvas of form.querySelectorAll('canvas')){canvas.getContext=()=>ctx;canvas.getBoundingClientRect=()=>({left:0,top:0,width:300,height:100});canvas.setPointerCapture=()=>{}}
 const previous=globalThis.Event;globalThis.Event=dom.window.Event;attachJhaSignatures(form);globalThis.Event=previous;
 return {dom,form,run(fn){const old=globalThis.Event;globalThis.Event=dom.window.Event;try{return fn()}finally{globalThis.Event=old}},pointer(role,type,x,y,id=1){const e=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId:id,pointerType:'touch'});this.run(()=>form.querySelector(`[data-jha-signature="${role}"]`).dispatchEvent(e))}};
}
test('two independently editable names and handwritten signatures survive draft restoration',()=>{
 const t=fixture();t.form.elements.jha_safety_name.value='Safety Updated';t.form.elements.jha_superintendent_name.value='Superintendent Updated';
 t.pointer('safety','pointerdown',30,20);t.pointer('safety','pointermove',120,50);t.pointer('safety','pointerup',120,50);
 t.pointer('superintendent','pointerdown',90,10);t.pointer('superintendent','pointermove',210,80);t.pointer('superintendent','pointercancel',210,80);
 const before=jhaApprovals(new t.dom.window.FormData(t.form));assert.deepEqual(before.safety.strokes,[[[.1,.2],[.4,.5]]]);assert.deepEqual(before.superintendent.strokes,[[[.3,.1],[.7,.8]]]);
 const restored=fixture();for(const el of t.form.elements){if(!el.name)continue;const target=restored.form.elements.namedItem(el.name);target.value=el.value;target.dispatchEvent(new restored.dom.window.Event('change',{bubbles:true}))}
 assert.deepEqual(jhaApprovals(new restored.dom.window.FormData(restored.form)),before);
 restored.run(()=>restored.form.querySelector('[data-jha-clear="safety"]').click());const after=jhaApprovals(new restored.dom.window.FormData(restored.form));assert.deepEqual(after.safety.strokes,[]);assert.deepEqual(after.superintendent,before.superintendent);assert.equal(after.safety.name,'Safety Updated');
});
test('PDF report preserves each saved name and signature and escapes user text',()=>{
 const approvals={safety:{name:'A <script>& Smith',strokes:[[[.1,.2],[.3,.4]]]},superintendent:{name:'Superintendent B',strokes:[[[.7,.8]]]}};
 const doc=new JSDOM(jhaSignaturesReport(approvals,tr)).window.document,blocks=doc.querySelectorAll('.ewr-signatures>div');
 assert.equal(blocks.length,2);assert.equal(blocks[0].querySelector('strong').textContent,approvals.safety.name);assert.equal(blocks[1].querySelector('strong').textContent,approvals.superintendent.name);assert.equal(doc.querySelector('script'),null);
 const svg=decodeURIComponent(blocks[0].querySelector('img').src.split(',')[1]);assert.match(svg,/M90,60 L270,120/);assert.equal(blocks[1].querySelector('small').textContent,'Jobsite Superintendent');
 assert.equal(new JSDOM(jhaSignaturesReport({safety:{name:'Name only'}},tr)).window.document.querySelectorAll('img').length,0);
});
test('invalid or injected signature coordinates are rejected without executing or rendering them',()=>{
 for(const value of ['bad',[[['<script>',.2]]],[[[Infinity,.2]]],[[[-1,.2]]],[[[1.2,.2]]],{},Array(501).fill([[.2,.3]])])assert.deepEqual(signatureStrokes(value),[]);
 assert.deepEqual(signatureStrokes('[[[0,1]]]'),[[[0,1]]]);
});
test('continuous signing groups draft notifications while retaining every point before submission',()=>{
 const t=fixture();let notifications=0,repaints=0;
 t.form.addEventListener('input',()=>notifications++);
 const canvas=t.form.querySelector('[data-jha-signature="safety"]');canvas.getContext('2d').clearRect=()=>repaints++;
 t.pointer('safety','pointerdown',10,10);
 for(let i=1;i<=100;i++)t.pointer('safety','pointermove',10+i,10+i/2);
 const saved=jhaApprovals(new t.dom.window.FormData(t.form));assert.equal(saved.safety.strokes[0].length,101);
 assert.equal(notifications,1);assert.equal(repaints,1);
 t.pointer('safety','pointerup',110,60);assert.equal(notifications,2);
});
