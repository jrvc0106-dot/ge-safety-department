import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quickSafetyOrientationForm,quickSafetyOrientationReport} from '../src/quick-safety-orientation.js';

const tr=en=>en;
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const project={name:'Test Jobsite',general_contractor:'Test GC'};
const reportOptions={tr,esc,fmt:value=>String(value),project,photos:[],signatureMarkup:'<section>Signed</section>'};
const record={
 id:'abcdef123456',orientation_at:'2026-10-12T18:00:00.000Z',
 employee_name:'Employee Test',sticker_number:'GE-123',employee_trade:'Carpenter',
 employee_company:'G&E Florida Contractors',hazards:[]
};

test('Quick Safety Orientation offers an optional bilingual telephone field',()=>{
 const english=quickSafetyOrientationForm({tr,esc,project,profile:{}});
 assert.match(english,/Employee Phone \(optional\)/);
 assert.match(english,/<input type="tel" name="employee_phone" autocomplete="tel" inputmode="tel" maxlength="32"/);
 assert.doesNotMatch(english,/name="employee_phone"[^>]*\srequired\b/);
 const spanish=quickSafetyOrientationForm({tr:(_en,es)=>es,esc,project,profile:{}});
 assert.match(spanish,/Teléfono del Empleado \(opcional\)/);
});

test('phone is visible and HTML escaped in the completed orientation report',()=>{
 const html=quickSafetyOrientationReport({...record,employee_phone:'(305) 555-0123'},reportOptions);
 assert.match(html,/Employee Phone/);
 assert.match(html,/<b>\(305\) 555-0123<\/b>/);
 assert.equal((html.match(/class="quick-report-employee"/g)||[]).length,1);
 const dangerous=quickSafetyOrientationReport({...record,employee_phone:'<script>alert(1)</script>'},reportOptions);
 assert.doesNotMatch(dangerous,/<script>alert/);
 assert.match(dangerous,/&lt;script&gt;/);
});

test('previous orientations without a phone remain readable',()=>{
 const html=quickSafetyOrientationReport(record,reportOptions);
 assert.doesNotMatch(html,/quick-report-phone-label/);
 assert.match(html,/Employee Test/);
});
