import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {simplifyDisciplineForm} from '../src/discipline-ui.js';

const tr=(en)=>en;
function sample(){
 const names=['employee_orientation_id','employee_name','employee_id','employee_position','employee_age','violation_type','incident_location','description','company_rule','osha_reference','hazard_observed','action_level','custom_action','immediate_action','supervisor_name','retraining_required','retraining_topic','follow_up_required','follow_up_notes','employee_comments','employee_acknowledged','evidence'];
 const doc=new JSDOM('<main><form id="discipline-form"></form></main>');
 const form=doc.window.document.querySelector('form');
 for(const name of names){
  const label=doc.window.document.createElement('label');
  const field=doc.window.document.createElement(name==='description'||name==='hazard_observed'||name==='custom_action'?'textarea':'input');
  field.name=name;if(name==='description'||name==='employee_name')field.required=true;
  if(name==='retraining_required'||name==='follow_up_required'||name==='employee_acknowledged')field.type='checkbox';
  if(name==='evidence')field.type='file';
  label.append(name,field);form.append(label);
 }
 form.insertAdjacentHTML('afterbegin','<div class="discipline-sticker-lookup"><input id="discipline-sticker-number"></div>');
 form.insertAdjacentHTML('beforeend','<div id="employee-discipline-summary"><span>history</span></div><div class="jha-approval-fields"><section><input name="jha_safety_name"></section><section><input name="jha_employee_name"></section></div><button type="submit">Save</button>');
 const hint=doc.window.document.createElement('small');hint.textContent='Photo evidence 10 MB';form.querySelector('[name=evidence]').closest('label').after(hint);
 return {dom:doc,form,names};
}

test('exactly four collapsible discipline steps preserve every existing input and signature',()=>{
 const {dom,form,names}=sample();
 const inputCount=form.querySelectorAll('[name]').length;
 const submit=form.querySelector('button[type=submit]'),signature=form.querySelector('.jha-approval-fields');
 simplifyDisciplineForm(form,tr);
 assert.equal(form.querySelectorAll('.discipline-step').length,4);
 assert.equal(form.querySelectorAll('.discipline-progress-label').length,4);
 assert.equal(form.querySelectorAll('[name]').length,inputCount);
 for(const name of names)assert.ok(form.elements.namedItem(name),name);
 assert.equal(form.querySelector('button[type=submit]'),submit);
 assert.equal(form.querySelector('.jha-approval-fields'),signature);
 assert.equal(form.querySelectorAll('.discipline-extra').length,2);
 assert.equal(form.querySelector('.discipline-step[data-step="1"]').open,true);
 assert.equal(form.querySelector('.discipline-step[data-step="2"]').open,false);
 assert.ok(form.querySelector('.discipline-step[data-step="4"]').contains(signature));
 assert.ok(form.querySelector('.discipline-step[data-step="4"]').textContent.includes('Photo evidence 10 MB'));
 simplifyDisciplineForm(form,tr);
 assert.equal(form.querySelectorAll('.discipline-step').length,4);
 dom.window.close();
});

test('navigation and validation reveal the correct step while keeping optional fields saved',()=>{
 const {dom,form}=sample();
 simplifyDisciplineForm(form,tr);
 form.elements.employee_name.value='Worker';
 form.elements.description.value='Observed missing fall protection';
 form.elements.custom_action.value='Additional training before reinstatement';
 form.elements.company_rule.value='Use required harness';
 form.elements.retraining_required.checked=true;
 form.querySelector('.discipline-step-next').click();
 assert.equal(form.querySelector('.discipline-step[data-step="1"]').open,false);
 assert.equal(form.querySelector('.discipline-step[data-step="2"]').open,true);
 assert.equal(form.querySelector('.discipline-step[data-step="2"] .discipline-extra').open,false);
 form.elements.company_rule.dispatchEvent(new dom.window.Event('invalid',{bubbles:false}));
 assert.equal(form.querySelector('.discipline-step[data-step="2"] .discipline-extra').open,true);
 const formData=new dom.window.FormData(form);
 assert.equal(formData.get('company_rule'),'Use required harness');
 assert.equal(formData.get('custom_action'),'Additional training before reinstatement');
 assert.equal(formData.get('retraining_required'),'on');
 dom.window.close();
});
