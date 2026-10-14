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

test('discipline stays a continuous form: all original fields and signatures visible',()=>{
 const {dom,form,names}=sample();
 const count=form.querySelectorAll('[name]').length;
 const submit=form.querySelector('button[type=submit]'),signature=form.querySelector('.jha-approval-fields');
 const originals=new Map(names.map(name=>[name,form.elements.namedItem(name)]));
 simplifyDisciplineForm(form,tr);
 assert.equal(form.querySelectorAll('.discipline-simple-section').length,4);
 assert.equal(form.querySelectorAll('.discipline-simple-heading').length,4);
 assert.equal(form.querySelectorAll('details,summary,.discipline-step-progress,.discipline-step-next').length,0);
 assert.equal(form.querySelectorAll('[name]').length,count);
 for(const name of names){
  assert.strictEqual(form.elements.namedItem(name),originals.get(name),name);
  assert.equal(form.elements.namedItem(name).closest('details'),null,name);
 }
 assert.equal(form.querySelector('button[type=submit]'),submit);
 assert.equal(form.querySelector('.jha-approval-fields'),signature);
 assert.ok(form.querySelector('.discipline-simple-section:last-of-type').contains(signature));
 assert.ok(form.querySelector('.discipline-simple-section:last-of-type').textContent.includes('Photo evidence 10 MB'));
 assert.equal(form.querySelector('button[type=submit]').closest('.discipline-simple-footer')?.tagName,'DIV');
 assert.deepEqual([...form.querySelectorAll('.discipline-simple-heading')].map(x=>x.textContent),['Employee Information','Safety Violation','Disciplinary Action','Evidence & Signatures']);
 simplifyDisciplineForm(form,tr);
 assert.equal(form.querySelectorAll('.discipline-simple-section').length,4);
 dom.window.close();
});

test('single-form layout retains all optional values, required fields and the current save payload',()=>{
 const {dom,form}=sample();
 simplifyDisciplineForm(form,tr);
 form.elements.employee_name.value='Worker';
 form.elements.description.value='Observed missing fall protection';
 form.elements.custom_action.value='Additional training before reinstatement';
 form.elements.company_rule.value='Use required harness';
 form.elements.retraining_required.checked=true;
 assert.equal(form.elements.employee_name.required,true);
 assert.equal(form.elements.description.required,true);
 assert.equal(form.querySelectorAll('details').length,0);
 const data=new dom.window.FormData(form);
 assert.equal(data.get('employee_name'),'Worker');
 assert.equal(data.get('description'),'Observed missing fall protection');
 assert.equal(data.get('company_rule'),'Use required harness');
 assert.equal(data.get('custom_action'),'Additional training before reinstatement');
 assert.equal(data.get('retraining_required'),'on');
 assert.equal(form.querySelectorAll('button[type=submit]').length,1);
 dom.window.close();
});

test('new unknown form controls are kept visible and included in FormData',()=>{
 const {dom,form}=sample();
 const label=dom.window.document.createElement('label');
 const input=dom.window.document.createElement('input');input.name='future_field';input.value='preserved';
 label.append(input);form.append(label);
 simplifyDisciplineForm(form,tr);
 assert.ok(form.querySelector('.discipline-simple-section:last-of-type').contains(label));
 assert.equal(new dom.window.FormData(form).get('future_field'),'preserved');
 dom.window.close();
});
