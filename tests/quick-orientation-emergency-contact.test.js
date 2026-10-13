import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quickSafetyOrientationForm,quickSafetyOrientationReport} from '../src/quick-safety-orientation.js';

const tr=(en)=>en;
const es=(_en,spanish)=>spanish;
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const project={name:'Project Test',general_contractor:'Test GC'};
const record={id:'abcdef123456',orientation_at:'2026-10-13T14:00:00.000Z',employee_name:'Test Employee',employee_phone:'(305) 555-0160',sticker_number:'G-200',employee_trade:'Carpenter',employee_company:'G&E Florida Contractors',hazards:[]};
const options={tr,esc,fmt:value=>String(value),project,photos:[],signatureMarkup:'<div>Signed</div>'};

test('Employee Information contains one bilingual free-text emergency contact field',()=>{
 const english=quickSafetyOrientationForm({tr,esc,project,profile:{}});
 const spanish=quickSafetyOrientationForm({tr:es,esc,project,profile:{}});
 assert.match(english,/Contact in case of emergency/);
 assert.match(spanish,/Contacto en caso de emergencia/);
 assert.match(english,/<input type="text" name="emergency_contact" maxlength="160" autocomplete="off">/);
 assert.equal((english.match(/name="emergency_contact"/g)||[]).length,1);
 assert.doesNotMatch(english,/name="emergency_contact"[^>]*\srequired\b/);
});

test('Emergency contact is displayed compactly in the completed report and safely escaped',()=>{
 const markup=quickSafetyOrientationReport({...record,emergency_contact:'Ana Gómez - (305) 555-0187'},options);
 assert.match(markup,/<div class="quick-report-emergency-contact"><span>Contact in case of emergency<\/span><b>Ana Gómez - \(305\) 555-0187<\/b><\/div>/);
 assert.ok(markup.indexOf('quick-report-emergency-contact')>markup.indexOf('class="quick-report-employee"'));
 assert.ok(markup.indexOf('quick-report-emergency-contact')<markup.indexOf('class="quick-report-hazards"'));
 assert.equal((markup.match(/class="quick-report-emergency-contact"/g)||[]).length,1);
 assert.match(markup,/quick-report-phone-label/);
 const hostile=quickSafetyOrientationReport({...record,emergency_contact:'<img src=x onerror=alert(1)>'},options);
 assert.doesNotMatch(hostile,/<img src=x onerror/);
 assert.match(hostile,/&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('Old reports without emergency contact are unchanged and labels localize',()=>{
 const oldMarkup=quickSafetyOrientationReport(record,options);
 assert.doesNotMatch(oldMarkup,/quick-report-emergency-contact/);
 const spanish=quickSafetyOrientationReport({...record,emergency_contact:'Madre: (305) 555-0187'},{...options,tr:es});
 assert.match(spanish,/Contacto en caso de emergencia/);
});

test('Compact emergency row preserves existing photo containment and existing signatures',()=>{
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(css,/\.quick-report-employee>\.quick-report-emergency-contact\{grid-column:1\/-1;display:flex/);
 assert.match(css,/\.quick-report-photos img\{display:block;width:100%;height:125px;object-fit:contain/);
 const report=quickSafetyOrientationReport({...record,emergency_contact:'Mother (305) 555-0199'},{...options,photos:[{url:'https://example.test/photo.png'}]});
 assert.match(report,/class="quick-report-photos"/);
 assert.match(report,/Signed/);
});
