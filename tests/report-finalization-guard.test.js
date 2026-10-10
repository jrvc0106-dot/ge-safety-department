import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {missingRequiredSignatures,guardReportFinalization} from '../src/report-finalization-guard.js';
function formFor(roles){
 const dom=new JSDOM('<form><button type="submit">Finalize</button></form>');
 const form=dom.window.document.querySelector('form');
 for(const role of roles){for(const suffix of ['name','signature']){const input=dom.window.document.createElement('input');input.name='jha_'+role+'_'+suffix;form.append(input)}}
 return {dom,form};
}
test('JHA requires both names and drawn signatures',()=>{
 const {dom,form}=formFor(['safety','superintendent']);
 assert.deepEqual(missingRequiredSignatures(form,'daily'),['safety','superintendent']);
 for(const role of ['safety','superintendent']){form.elements['jha_'+role+'_name'].value=role;form.elements['jha_'+role+'_signature'].value='[[[0.1,0.2]]]'}
 assert.deepEqual(missingRequiredSignatures(form,'daily'),[]);
 form.elements.jha_superintendent_signature.value='[]';
 assert.deepEqual(missingRequiredSignatures(form,'daily'),['superintendent']);
 dom.window.close();
});
test('unsigned finalization blocked but signed finalization passes',()=>{
 const {dom,form}=formFor(['safety','foreman']);
 guardReportFinalization(form,'observation',(en)=>en);
 let saved=0;form.onsubmit=()=>saved++;
 form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(saved,0);assert.ok(form.querySelector('[role=alert]'));
 for(const role of ['safety','foreman']){form.elements['jha_'+role+'_name'].value=role;form.elements['jha_'+role+'_signature'].value='[[[0.1,0.2]]]'}
 form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(saved,1);
 dom.window.close();
});
