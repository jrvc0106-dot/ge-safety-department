import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderIncidentReport} from '../src/incident-report-template.js';

const tr=(en)=>en;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>String(value??'');
const report={
 incident_type:'injury',employee_name:'Test Employee',report_number:'IR-QA-001',
 project:{name:'Rivage'},what_happened:'Test description',
 corrective_actions:'Barricade area and inspect',witnesses:[],
 approvals:{}
};
for(const count of [0,1,2,3,6,7]){
 test('incident final PDF template keeps compact sequential sections and evidence, photos='+count,()=>{
  const photos=Array.from({length:count},(_,i)=>({url:'https://example.invalid/evidence'+i+'.jpg',caption:'Evidence '+(i+1)}));
  const html=renderIncidentReport(report,photos,{tr,esc,fmt});
  const dom=new JSDOM(html);
  try{
   const document=dom.window.document;
   const sections=[...document.querySelectorAll('article.incident-pdf section.ir-section')];
   const labels=sections.map(section=>section.querySelector('h2')?.textContent||'');
   const numbers=sections.map(section=>section.querySelector('h2 span')?.textContent);
   assert.deepEqual(numbers,Array.from({length:sections.length},(_,i)=>String(i+1).padStart(2,'0')));
   assert.equal(labels.some(label=>label.includes('OSHA recordability review')),false);
   assert.equal(labels.some(label=>label.includes('Severe event screening')),false);
   assert.equal(sections.length,count?8:7);
   assert.equal(document.querySelectorAll('.ir-photos figure').length,count);
   assert.equal(document.querySelectorAll('.ir-photos figure img').length,count);
   assert.equal(document.querySelector('header.ir-head img')?.getAttribute('src'),'/ge-logo.png');
   assert.ok(labels.at(-1).includes('Investigation closeout'));
   assert.ok(html.includes('Barricade area and inspect'));
   for(let i=0;i<count;i++){
    const figure=document.querySelectorAll('.ir-photos figure')[i];
    assert.equal(figure.querySelector('img')?.getAttribute('src'),photos[i].url);
    assert.ok(figure.textContent.includes(photos[i].caption));
   }
  }finally{dom.window.close()}
 });
}
