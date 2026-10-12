import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachQuickHazardSelection,QUICK_ORIENTATION_ACK,QUICK_ORIENTATION_HAZARDS,quickSafetyAccountName,quickSafetyOrientationForm,quickSafetyOrientationReport} from '../src/quick-safety-orientation.js';

const tr=(en)=>en;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

test('quick orientation provides separate employee fields, risk selection, consent and four-photo limit',()=>{
 const html=quickSafetyOrientationForm({tr,esc,project:{name:'Rivage Bal Harbour'},profile:{}});
 for(const text of ['Quick Safety Orientation','Employee Name','Sticker Number','Position / Trade','Company','quick-employee-field','Jobsite Hazards & Safety Controls','quick-hazard-toggle-all','Select all','Take photo','Choose from gallery','/ 4','Employee Acknowledgment','Save & Create Final Report'])assert.ok(html.includes(text),text);
 assert.equal(QUICK_ORIENTATION_HAZARDS.length,16);
 assert.ok(html.includes('name="acknowledged" required'));
});

test('safety signer name comes from the signed-in account with email fallback',()=>{
 assert.equal(quickSafetyAccountName({name:'Jairo Valdivia',position:'Safety Director',email:'safety@example.com'},'login@example.com'),'Jairo Valdivia — Safety Director');
 assert.equal(quickSafetyAccountName({name:'Jairo Valdivia',position:'',email:'safety@example.com'},'login@example.com'),'Jairo Valdivia');
 assert.equal(quickSafetyAccountName({name:'',position:'Safety Director',email:'safety@example.com'},'login@example.com'),'safety@example.com — Safety Director');
 assert.equal(quickSafetyAccountName({},'login@example.com'),'login@example.com');
});

test('select all toggles every hazard and keeps the count and button state in sync',()=>{
 const dom=new JSDOM('<form><button id="quick-hazard-toggle-all" type="button"></button><span id="quick-hazard-selected"></span><input type="checkbox" name="hazards"><input type="checkbox" name="hazards"></form>');
 const form=dom.window.document.querySelector('form');attachQuickHazardSelection(form,tr);
 const button=form.querySelector('#quick-hazard-toggle-all'),count=form.querySelector('#quick-hazard-selected'),inputs=[...form.querySelectorAll('[name="hazards"]')];
 assert.equal(button.textContent,'Select all');assert.equal(count.textContent,'0');
 button.click();assert.ok(inputs.every(input=>input.checked));assert.equal(button.textContent,'Clear all');assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(count.textContent,'2');
 button.click();assert.ok(inputs.every(input=>!input.checked));assert.equal(button.textContent,'Select all');assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(count.textContent,'0');
 dom.window.close();
});

test('final report only lists selected hazards and includes acknowledgment, photos and signatures',()=>{
 const selected=QUICK_ORIENTATION_HAZARDS.slice(0,2).map(h=>({key:h.key,label:h.en,control:h.controlEn}));
 const html=quickSafetyOrientationReport({id:'abc12345',employee_name:'A&B Worker',sticker_number:'GE-123',employee_trade:'Glazier',employee_company:'G&E Florida Contractors',orientation_at:'2026-10-12T12:00:00Z',hazards:selected},{tr,esc,fmt:()=> 'Oct 12, 2026',project:{name:'Rivage'},photos:[{url:'https://example.test/photo.jpg'}],signatureMarkup:'SIGNATURES'});
 assert.ok(html.includes('A&amp;B Worker'));
 assert.ok(html.includes(QUICK_ORIENTATION_ACK.en));
 assert.ok(html.includes('Falls / edges / floor openings'));
 assert.ok(!html.includes('Scaffolds / swing stages'));
 assert.ok(html.includes('Orientation Photos'));
 assert.ok(html.includes('SIGNATURES'));
});
