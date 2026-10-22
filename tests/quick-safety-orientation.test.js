import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachQuickHazardSelection,attachQuickEmployeeSignatureName,QUICK_ORIENTATION_ACK,QUICK_ORIENTATION_HAZARDS,quickSafetyAccountName,quickSafetyOrientationForm,quickSafetyOrientationReport} from '../src/quick-safety-orientation.js';

const tr=(en)=>en;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

test('quick orientation retains employee fields, Face ID, risk selection and consent without Jobsite Photos',()=>{
 const html=quickSafetyOrientationForm({tr,esc,project:{name:'Rivage Bal Harbour'},profile:{}});
 for(const text of ['Quick Safety Orientation','Employee Name','Sticker Number','Position / Trade','Company','quick-employee-field','Jobsite Hazards & Safety Controls','quick-hazard-toggle-all','Select all','Employee Face ID','quick-face-camera','quick-face-gallery','Employee Acknowledgment','Save & Create Final Report'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('Jobsite Photos'));
 assert.ok(!html.includes('id="quick-photo-camera"'));
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

test('typing Employee Name fills the employee signature name immediately without a second entry',()=>{
 const dom=new JSDOM('<form><input name="employee_name" required><label>Employee<input name="jha_employee_name"></label><input type="hidden" name="jha_employee_signature" value="[]"><button type="button" data-jha-clear="employee">Clear signature</button></form>');
 const form=dom.window.document.querySelector('form');
 const employee=form.elements.namedItem('employee_name'),signer=form.elements.namedItem('jha_employee_name');
 const sync=attachQuickEmployeeSignatureName(form);
 assert.equal(signer.readOnly,true);
 employee.value='Juan Pérez';
 employee.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 assert.equal(signer.value,'Juan Pérez');
 assert.equal(new dom.window.FormData(form).get('jha_employee_name'),'Juan Pérez');
 employee.value='Juan Pérez García';
 employee.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 assert.equal(signer.value,'Juan Pérez García');
 assert.equal(new dom.window.FormData(form).get('jha_employee_name'),'Juan Pérez García');
 // Browser autofill may update the original field without an input event.
 employee.value='María López';
 sync();
 assert.equal(signer.value,'María López');
 dom.window.close();
});

test('changing employee identity after signing clears only the old worker signature',()=>{
 const dom=new JSDOM('<form><input name="employee_name"><input name="jha_employee_name"><input name="jha_employee_signature" value="[]"><button type="button" data-jha-clear="employee">Clear signature</button></form>');
 const form=dom.window.document.querySelector('form');
 const employee=form.elements.namedItem('employee_name'),signature=form.elements.namedItem('jha_employee_signature');
 let cleared=0;
 form.querySelector('[data-jha-clear]').onclick=()=>{signature.value='[]';cleared++};
 attachQuickEmployeeSignatureName(form);
 employee.value='Worker One';employee.dispatchEvent(new dom.window.Event('input'));
 signature.value='[[[0.1,0.1],[0.2,0.2]]]';
 employee.value='Worker Two';employee.dispatchEvent(new dom.window.Event('input'));
 assert.equal(cleared,1);
 assert.equal(signature.value,'[]');
 assert.equal(form.elements.namedItem('jha_employee_name').value,'Worker Two');
 assert.equal(new dom.window.FormData(form).get('jha_employee_name'),'Worker Two');
 dom.window.close();
});

test('Quick Orientation clears the auto-filled employee signature name on form reset',async()=>{
 const dom=new JSDOM('<form><input name="employee_name"><input name="jha_employee_name"><input name="jha_employee_signature" value="[]"></form>');
 const form=dom.window.document.querySelector('form'),employee=form.elements.namedItem('employee_name'),signer=form.elements.namedItem('jha_employee_name');
 attachQuickEmployeeSignatureName(form);
 employee.value='Worker One';employee.dispatchEvent(new dom.window.Event('input'));
 form.reset();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(employee.value,'');
 assert.equal(signer.value,'');
 dom.window.close();
});

test('final Quick Orientation displays the signed Employee Face ID in the information block',()=>{
 const record={id:'photo-1234',employee_name:'Worker Example',sticker_number:'GE-585',employee_trade:'Ironworker',employee_company:'G&E',orientation_at:'2026-10-21T12:00:00Z',hazards:[]};
 const url='https://example.test/private-face.jpg?token=abc';
 const html=quickSafetyOrientationReport(record,{tr,esc,fmt:()=> 'Oct 21, 2026',project:{name:'The Crossings'},photos:[],facePhotoUrl:url,signatureMarkup:'SIGNED'});
 const dom=new JSDOM(html);
 const report=dom.window.document.querySelector('.quick-safety-orientation-report');
 const employee=report.querySelector('.quick-report-employee');
 const photo=employee.querySelector('.quick-report-employee-photo img');
 assert.ok(employee.classList.contains('has-face-photo'));
 assert.ok(photo,'Employee Face ID is shown inside Employee Information');
 assert.equal(photo.getAttribute('src'),url);
 assert.equal(photo.closest('.quick-report-employee'),employee);
 assert.match(report.textContent,/Employee Photo/);
 assert.match(report.textContent,/The Crossings/);
 assert.match(report.textContent,/SIGNED/);
 assert.equal(report.querySelector('.quick-report-header>img').getAttribute('src'),'/ge-logo.png','Official G&E logo stays unchanged');
 assert.equal(report.querySelector('.print-report-watermark img').getAttribute('src'),'/ge-logo.png','Original watermark stays unchanged');
 dom.window.close();
});
test('legacy Quick Orientation without a saved face photo keeps the approved layout',()=>{
 const record={id:'legacy-1234',employee_name:'Worker Example',sticker_number:'GE-585',employee_trade:'Ironworker',employee_company:'G&E',orientation_at:'2026-10-21T12:00:00Z',hazards:[]};
 const html=quickSafetyOrientationReport(record,{tr,esc,fmt:()=> 'Oct 21, 2026',project:{name:'The Crossings'},photos:[],signatureMarkup:'SIGNED'});
 const dom=new JSDOM(html);
 assert.equal(dom.window.document.querySelector('.quick-report-employee-photo'),null);
 assert.equal(dom.window.document.querySelector('.quick-report-employee.has-face-photo'),null);
 assert.ok(dom.window.document.querySelector('.quick-report-header>img'));
 dom.window.close();
});
test('Quick Orientation face photo URL is escaped in report HTML',()=>{
 const record={id:'photo-1234',employee_name:'Worker Example',sticker_number:'GE-585',employee_trade:'Ironworker',employee_company:'G&E',orientation_at:'2026-10-21T12:00:00Z',hazards:[]};
 const html=quickSafetyOrientationReport(record,{tr,esc,fmt:()=> '',project:{name:'The Crossings'},photos:[],facePhotoUrl:'https://example.test/face.jpg" onerror="alert(1)',signatureMarkup:'SIGNED'});
 const dom=new JSDOM(html);
 const photo=dom.window.document.querySelector('.quick-report-employee-photo img');
 assert.ok(photo);
 assert.equal(photo.getAttribute('onerror'),null);
 assert.equal(photo.getAttribute('src'),'https://example.test/face.jpg" onerror="alert(1)');
 dom.window.close();
});
