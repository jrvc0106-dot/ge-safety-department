import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const start=source.indexOf("excavation_daily:{name:'Daily Excavation Inspection'");
const end=source.indexOf("\n other:{name:",start);
const definition=source.slice(start,end);

test('daily excavation inspection is registered with OSHA Subpart P and practical checks',()=>{
 assert.ok(start>0,'inspection option must exist');
 assert.match(definition,/1926\.650–652/);
 for(const requirement of ['Competent person','Underground utilities','Soil classification','Protective system','Safe egress','Spoil piles','Water accumulation','Hazardous atmosphere','Adjacent structures','cave-in']){
  assert.ok(definition.toLowerCase().includes(requirement.toLowerCase()),'missing '+requirement);
 }
});

test('excavation fields and safety gates are wired into equipment workflow',()=>{
 assert.match(source,/id="excavation-details"/);
 for(const field of ['exc_depth','exc_width','exc_soil','exc_protection'])assert.ok(source.includes('name="'+field+'"'));
 assert.match(source,/competent_person.*'on'/);
 assert.match(source,/critical\|\|incomplete/);
 assert.match(source,/STOP WORK \/ DO NOT ENTER/);
 assert.match(source,/depth>=5/);
});

test('excavation uses existing project-bound report, evidence and PDF workflow',()=>{
 assert.match(source,/equipmentInspectionTypes\[type\.value\]/);
 assert.match(source,/project_id:formProjectId,created_by:formUserId/);
 assert.match(source,/draftFilesFor\(form,'equipment_inspection'/);
 assert.match(source,/db\.storage\.from\('equipment-inspections'\)\.upload/);
 assert.match(source,/navigate\('equipmentInspectionReport',id\)/);
 assert.match(source,/class="report professional-report equipment-pdf"/);
});

test('excavation PDF omits legacy equipment fields and groups corrective actions and photos',async()=>{
 const vm=await import('node:vm');
 const start=source.indexOf('async function equipmentInspectionReport()');
 const end=source.indexOf('\nasync function incidentReportForm()',start);
 const row={equipment_type:'excavation_daily',equipment_name:'Old unit',asset_id:'Old asset',manufacturer:'Old maker',
  model:'Old model',serial_number:'Old serial',project:{name:'Rivage'},location:'North trench',
  report_number:'EI-TEST',checklist:[{result:'fail',item:'Sample failed check',note:'Field finding'}],
  corrective_action:'Corrected onsite',photos:[{path:'a'},{path:'b'},{path:'c'}]};
 const query={select(){return this},eq(){return this},single:async()=>({data:row})};
 let markup;
 const context=vm.createContext({captureView:()=>()=>true,db:{from:()=>query},state:{},
  tr:x=>x,esc:x=>String(x??''),HOTWORK_TYPE:'hotwork',equipmentInspectionTypes:{},equipmentReportDate:()=> 'Nov 26, 2026',
  signedDisplayImage:async()=>'/sample.jpg',reportSignaturesReport:()=>'<div>Signatures</div>',frame:html=>{markup=html}});
 vm.runInContext(source.slice(start,end),context);
 await context.equipmentInspectionReport();
 assert.doesNotMatch(markup,/Old unit|Old asset|Old maker|Old model|Old serial|<b>Serial Number/);
 assert.match(markup,/eq-excavation-findings.*Sample failed check.*Field finding.*Corrected onsite/);
 assert.match(markup,/Rivage.*North trench.*Nov 26, 2026/);
 assert.match(markup,/Signatures/);
 assert.equal((markup.match(/<figure>/g)||[]).length,3);
 assert.doesNotMatch(markup,/data-equipment-pdf-page/);
 row.equipment_type='forklift';
 await context.equipmentInspectionReport();
 assert.match(markup,/Old unit.*Old asset.*Old maker.*Old model.*Old serial/);
 assert.match(markup,/data-equipment-pdf-page/);
});
