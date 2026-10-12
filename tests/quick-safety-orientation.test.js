import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QUICK_ORIENTATION_ACK,QUICK_ORIENTATION_HAZARDS,quickSafetyOrientationForm,quickSafetyOrientationReport} from '../src/quick-safety-orientation.js';

const tr=(en)=>en;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

test('quick orientation provides separate employee fields, risk selection, consent and four-photo limit',()=>{
 const html=quickSafetyOrientationForm({tr,esc,project:{name:'Rivage Bal Harbour'},profile:{}});
 for(const text of ['Quick Safety Orientation','Employee Name','Sticker Number','Position / Trade','Company','Jobsite Hazards & Safety Controls','Take photo','Choose from gallery','/ 4','Employee Acknowledgment','Save & Create Final Report'])assert.ok(html.includes(text),text);
 assert.equal(QUICK_ORIENTATION_HAZARDS.length,16);
 assert.ok(html.includes('name="acknowledged" required'));
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
