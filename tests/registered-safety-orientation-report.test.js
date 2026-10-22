import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {registeredSafetyOrientationReport} from '../src/registered-safety-orientation-report.js';

const tr=(en)=>en;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const record={
 id:'abc123',project_id:'project-a',sticker_number:'GE-00125',
 employee_name:'Employee A',employee_company:'G&E',employee_position:'Carpenter',
 orientation_date:'2026-10-21',notes:'Safety site briefing',approvals:{}
};
const args={
 tr,esc,fmt:date=>date,project:{name:'The Crossings',general_contractor:'General Contractor'},
 photos:{face:'https://test.invalid/face.jpg',sticker:'https://test.invalid/sticker.jpg',document:'https://test.invalid/document.jpg',certificates:['https://test.invalid/certificate.jpg']},
 signatureMarkup:'SAFETY AND EMPLOYEE SIGNATURES'
};
test('Register Safety Orientation final PDF includes correct employee, jobsite, sticker, both required photos and real signatures',()=>{
 const dom=new JSDOM(registeredSafetyOrientationReport(record,args));
 const report=dom.window.document.querySelector('article.report.registered-safety-orientation-report');
 assert.ok(report);
 const text=report.textContent;
 for(const expected of ['Employee A','GE-00125','The Crossings','Carpenter','G&E','Safety site briefing','SAFETY AND EMPLOYEE SIGNATURES','Training Certificates'])
  assert.ok(text.includes(expected),expected);
 const imgs=report.querySelectorAll('.registered-orientation-evidence img');
 assert.equal(imgs.length,4);
 assert.equal(imgs[0].getAttribute('src'),'https://test.invalid/face.jpg');
 assert.equal(imgs[1].getAttribute('src'),'https://test.invalid/sticker.jpg');
 assert.equal(report.querySelector('.registered-orientation-header>img').getAttribute('src'),'/ge-logo.png');
 assert.equal(report.querySelector('.print-report-watermark img').getAttribute('src'),'/ge-logo.png');
 assert.equal(report.querySelector('.print-report-number b').textContent,'SO-GE-00125');
 dom.window.close();
});
test('Register Safety Orientation PDF omits non-recorded optional images and marks unavailable required evidence',()=>{
 const dom=new JSDOM(registeredSafetyOrientationReport({...record,notes:null}, {...args,photos:{}}));
 const report=dom.window.document.querySelector('article.report');
 assert.equal(report.querySelectorAll('.registered-orientation-evidence img').length,0);
 assert.equal(report.querySelectorAll('.registered-orientation-evidence-missing').length,1);
 assert.ok(!report.textContent.includes('Training Certificates'));
 assert.ok(!report.textContent.includes('Safety site briefing'));
 dom.window.close();
});
test('personal information and signed image URLs are HTML escaped',()=>{
 const html=registeredSafetyOrientationReport({...record,employee_name:'<script>bad</script>',notes:'<img src=x onerror=alert(1)>'},{
  ...args,photos:{face:'https://test.invalid/face.jpg" onerror="alert(1)',sticker:'https://test.invalid/sticker.jpg'}
 });
 const dom=new JSDOM(html);
 assert.equal(dom.window.document.querySelector('script'),null);
 assert.equal(dom.window.document.querySelector('img[onerror]'),null);
 assert.equal(dom.window.document.querySelector('.registered-orientation-evidence img').getAttribute('src'),'https://test.invalid/face.jpg" onerror="alert(1)');
 dom.window.close();
});
test('full Safety Orientation report is jobsite scoped and integrates with PDF export workflow',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const style=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(source,/state\.page==='safetyOrientationReport'/);
 assert.match(source,/const q=await db\.from\('safety_orientations'\)\.select\('\*'\)\.eq\('id',id\)\.eq\('project_id',projectId\)\.single\(\)/);
 assert.match(source,/navigate\('safetyOrientationReport',save\.data\.id\)/);
 assert.match(source,/navigate\('safetyOrientationReport',o\.id\)/);
 assert.match(source,/safetyOrientationReport:'training'/);
 assert.match(style,/\.registered-orientation-evidence img\{[^\n]*object-fit:contain/);
 assert.match(style,/\.registered-orientation-header>img\{[^\n]*object-fit:contain/);
});
