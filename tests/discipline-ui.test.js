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

test('discipline stays a continuous form: all original fields and signatures are retained',()=>{
 const {dom,form,names}=sample();
 const count=form.querySelectorAll('[name]').length;
 const submit=form.querySelector('button[type=submit]'),signature=form.querySelector('.jha-approval-fields');
 const originals=new Map(names.map(name=>[name,form.elements.namedItem(name)]));
 simplifyDisciplineForm(form,tr);
 assert.equal(form.querySelectorAll('.discipline-simple-section').length,4);
 assert.equal(form.querySelectorAll('.discipline-simple-heading').length,4);
 assert.equal(form.querySelectorAll('details.discipline-optional-details').length,3);
 assert.equal(form.querySelectorAll('.discipline-step-progress,.discipline-step-next').length,0);
 assert.equal(form.querySelectorAll('[name]').length,count);
 for(const name of names){
  assert.strictEqual(form.elements.namedItem(name),originals.get(name),name);
  if(['employee_id','employee_age','osha_reference','employee_comments'].includes(name))assert.ok(form.elements.namedItem(name).closest('details'),name);
  else assert.equal(form.elements.namedItem(name).closest('details'),null,name);
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
 assert.equal(form.querySelectorAll('details').length,3);
 const data=new dom.window.FormData(form);
 assert.equal(data.get('employee_name'),'Worker');
 assert.equal(data.get('description'),'Observed missing fall protection');
 assert.equal(data.get('company_rule'),'Use required harness');
 assert.equal(data.get('custom_action'),'Additional training before reinstatement');
 assert.equal(data.get('retraining_required'),'on');
 assert.equal(form.querySelectorAll('button[type=submit]').length,1);
 dom.window.close();
});

test('new unknown form controls are preserved and included in FormData',()=>{
 const {dom,form}=sample();
 const label=dom.window.document.createElement('label');
 const input=dom.window.document.createElement('input');input.name='future_field';input.value='preserved';
 label.append(input);form.append(label);
 simplifyDisciplineForm(form,tr);
 assert.ok(form.querySelector('.discipline-simple-section:last-of-type').contains(label));
 assert.equal(new dom.window.FormData(form).get('future_field'),'preserved');
 dom.window.close();
});

test('the sticker lookup stays first and all four core sections remain readable',()=>{
 const {dom,form}=sample();
 const lookup=form.querySelector('.discipline-sticker-lookup');
 const signature=form.querySelector('.jha-approval-fields');
 simplifyDisciplineForm(form,tr);
 const sections=Array.from(form.querySelectorAll('.discipline-simple-section'));
 assert.equal(sections[0].querySelector('.discipline-simple-fields').firstElementChild,lookup);
 assert.equal(sections[0].dataset.section,'1');
 assert.equal(sections[3].dataset.section,'4');
 assert.ok(sections[0].querySelector('.discipline-section-header'));
 assert.equal(sections[0].querySelector('.discipline-section-number').textContent,'01');
 assert.equal(sections[3].querySelector('.discipline-section-number').textContent,'04');
 assert.equal(sections[0].querySelector('.discipline-simple-fields [name=employee_orientation_id]')!==null,true);
 assert.equal(sections[0].querySelector('.discipline-simple-fields [name=employee_name]')!==null,true);
 assert.equal(sections[1].querySelector('.discipline-simple-fields [name=description]')!==null,true);
 assert.equal(sections[2].querySelector('.discipline-simple-fields [name=action_level]')!==null,true);
 assert.equal(sections[3].querySelector('.jha-approval-fields'),signature);
 assert.equal(form.querySelectorAll('details').length,3);
 assert.equal(form.querySelectorAll('[hidden]').length,0);
 assert.equal(sections[1].querySelector('label:has([name=description])').classList.contains('discipline-priority-field'),true);
 assert.equal(form.querySelectorAll('input,select,textarea').length>0,true);
 dom.window.close();
});

test('form presentation does not replace the sticker controls or touch-signature inputs',()=>{
 const {dom,form}=sample();
 const lookup=form.querySelector('.discipline-sticker-lookup');
 const originalName=form.elements.employee_name;
 const signature=form.elements.jha_employee_name;
 const callback=()=>{};
 lookup.addEventListener('click',callback);
 simplifyDisciplineForm(form,tr);
 assert.equal(form.querySelector('.discipline-sticker-lookup'),lookup);
 assert.equal(form.elements.employee_name,originalName);
 assert.equal(form.elements.jha_employee_name,signature);
 assert.ok(form.querySelector('.discipline-simple-section[data-section="1"]').contains(lookup));
 assert.ok(form.querySelector('.discipline-simple-section[data-section="4"]').contains(signature));
 assert.equal(form.querySelectorAll('button[type=submit]').length,1);
 dom.window.close();
});

test('secondary details are accessible and automatically open when a saved value exists',()=>{
 const {dom,form}=sample();
 form.elements.employee_age.value='34';
 form.elements.osha_reference.value='Applicable standard under review';
 simplifyDisciplineForm(form,tr);
 const optional=[...form.querySelectorAll('.discipline-optional-details')];
 assert.equal(optional.length,3);
 assert.equal(optional[0].open,true);
 assert.equal(optional[1].open,true);
 assert.equal(optional[2].open,false);
 assert.equal(new dom.window.FormData(form).get('osha_reference'),'Applicable standard under review');
 assert.equal(new dom.window.FormData(form).get('employee_age'),'34');
 dom.window.close();
});

test('retraining and follow-up details appear on demand without removing form values',()=>{
 const {dom,form}=sample();
 simplifyDisciplineForm(form,tr);
 const topic=form.elements.retraining_topic.closest('label');
 const follow=form.elements.follow_up_notes.closest('label');
 assert.equal(topic.style.display,'none');
 assert.equal(follow.style.display,'none');
 form.elements.retraining_required.checked=true;
 form.elements.retraining_required.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.equal(topic.style.display,'');
 form.elements.retraining_topic.value='Correct PPE use';
 form.elements.retraining_required.checked=false;
 form.elements.retraining_required.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.equal(topic.style.display,'');
 assert.equal(new dom.window.FormData(form).get('retraining_topic'),'Correct PPE use');
 dom.window.close();
});

test('violation guidance changes without adding invented facts or OSHA citations',()=>{
 const {dom,form}=sample();
 simplifyDisciplineForm(form,tr);
 const guide=form.querySelector('.discipline-violation-guide');
 assert.ok(guide);
 const before=form.elements.description.value;
 form.elements.violation_type.value='PPE';
 form.elements.violation_type.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.match(guide.textContent,/protective equipment/);
 assert.equal(form.elements.description.value,before);
 assert.equal(form.elements.osha_reference.value,'');
 dom.window.close();
});
