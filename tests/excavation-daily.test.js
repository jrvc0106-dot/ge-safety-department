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
