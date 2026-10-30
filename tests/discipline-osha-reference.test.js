import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {
 DISCIPLINE_OSHA_REFERENCES,relatedDisciplineOshaReferences,
 prioritizeDisciplineOshaReferences,attachDisciplineViolationControls,disciplineViolationForSave
} from '../src/discipline-osha-reference.js';
import {markDisciplineMissingFields} from '../src/discipline-ui.js';

function fixture(){
 const dom=new JSDOM('<form><label>Violation<select name="violation_type"><option value="PPE">PPE</option><option value="Fall Protection">Fall Protection</option><option value="Missing required safety whistle">Missing required safety whistle</option><option value="__custom__">Custom</option></select></label><label id="custom" hidden>Custom<input name="violation_custom"></label><label>OSHA<select name="osha_reference"><option value="">Select</option></select></label><label>Name<input name="employee_name"></label><div class="jha-approval"><input name="jha_employee_signature" type="hidden" value="[]"></div></form>');
 return {dom,form:dom.window.document.querySelector('form')};
}

test('OSHA catalog covers 40+ verified construction standards and prioritizes related rules',()=>{
 assert.ok(DISCIPLINE_OSHA_REFERENCES.length>=40);
 const t=fixture();
 const ranked=prioritizeDisciplineOshaReferences(t.form.elements.osha_reference,'Fall Protection');
 assert.deepEqual(ranked.slice(0,3),['1926.501','1926.502','1926.503']);
 const all=[...t.form.elements.osha_reference.options].map(x=>x.value);
 assert.match(all[1],/1926.501/);
 assert.match(all[2],/1926.502/);
 assert.equal(t.form.elements.osha_reference.value,'','Never auto-apply an OSHA citation');
 t.dom.window.close();
});

test('company-only conduct and whistle rules receive no unfounded OSHA suggestions',()=>{
 assert.deepEqual(relatedDisciplineOshaReferences('Missing required safety whistle'),[]);
 assert.deepEqual(relatedDisciplineOshaReferences('Disrespect toward coworkers or leaders'),[]);
 assert.deepEqual(relatedDisciplineOshaReferences('A custom policy violation'),[]);
});

test('OSHA priority updates while preserving any deliberate previous selection',()=>{
 const t=fixture(),select=t.form.elements.osha_reference;
 prioritizeDisciplineOshaReferences(select,'PPE');
 const chosen=[...select.options].find(x=>x.value.includes('1926.102'));
 select.value=chosen.value;
 prioritizeDisciplineOshaReferences(select,'Fall Protection');
 assert.equal(select.value,chosen.value);
 t.dom.window.close();
});

test('custom violation requires actual written text, but does not change saved schema',()=>{
 const t=fixture(),form=t.form;
 attachDisciplineViolationControls(form);
 assert.equal(form.elements.violation_custom.disabled,true);
 form.elements.violation_type.value='__custom__';
 form.elements.violation_type.dispatchEvent(new t.dom.window.Event('change',{bubbles:true}));
 assert.equal(form.elements.violation_custom.required,true);
 assert.equal(form.elements.violation_custom.disabled,false);
 assert.equal(form.elements.violation_custom.closest('label').hidden,false);
 form.elements.violation_custom.value='Failure to secure designated barricade';
 assert.equal(disciplineViolationForSave(new t.dom.window.FormData(form)),'Failure to secure designated barricade');
 form.elements.violation_type.value='PPE';
 form.elements.violation_type.dispatchEvent(new t.dom.window.Event('change',{bubbles:true}));
 assert.equal(disciplineViolationForSave(new t.dom.window.FormData(form)),'PPE');
 assert.equal(form.elements.violation_custom.disabled,true);
 t.dom.window.close();
});

test('assistant review marks the actual missing field and signature red without deleting values',()=>{
 const t=fixture(),form=t.form;
 const name=form.elements.employee_name;name.value='';
 const signature=form.elements.jha_employee_signature;
 assert.equal(markDisciplineMissingFields(form,[['employee_name'],['jha_employee_signature']]),2);
 assert.equal(name.classList.contains('discipline-ai-incomplete'),true);
 assert.equal(signature.closest('.jha-approval').classList.contains('discipline-ai-incomplete'),true);
 name.value='Safe Worker';
 assert.equal(markDisciplineMissingFields(form,[['jha_employee_signature']]),1);
 assert.equal(name.classList.contains('discipline-ai-incomplete'),false);
 assert.equal(name.value,'Safe Worker');
 t.dom.window.close();
});
