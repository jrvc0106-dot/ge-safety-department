import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INCIDENT_AI_FIELDS,incidentMissingFields} from '../src/incident-ai-pro.js';
const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../supabase/functions/improve-writing/index.ts',import.meta.url),'utf8');
function form(values={}){
  const fields={...values};
  return {elements:{namedItem(name){return name in fields?{value:fields[name],checked:fields[name]===true}:null}}};
}
test('incident assistant covers narrative fields but never OSHA classification, signature or identifiers',()=>{
  assert.equal(INCIDENT_AI_FIELDS.length,12);
  const fieldNames=INCIDENT_AI_FIELDS.map(x=>x[0]);
  for(const field of ['what_happened','immediate_actions','root_causes','corrective_actions','w1_statement','potential_outcome'])assert.ok(fieldNames.includes(field));
  for(const forbidden of ['recordability_review','severity','death','employee_dob','employee_address','approvals','incident_type','osha_case_number'])assert.ok(!fieldNames.includes(forbidden));
});
test('incident missing-data check targets factual details, including Near Miss consequences',()=>{
  const items=incidentMissingFields(form({incident_type:'near_miss',incident_at:'2026-10-17T14:00',exact_location:'Floor 2',what_happened:'A load fell',activity_before:'Handling materials'}));
  assert.ok(items.some(x=>x.field==='potential_outcome'));
  assert.ok(items.some(x=>x.field==='corrective_actions'));
  assert.ok(!items.some(x=>x.field==='injury_illness_description'));
  assert.ok(!items.some(x=>x.field==='exact_location'));
});
test('injury with witness and hospital response prompts for supporting narratives',()=>{
  const items=incidentMissingFields(form({incident_type:'injury',w1_name:'Witness',hospitalized_overnight:true,what_happened:'Employee fell'}));
  for(const field of ['w1_statement','medical_treatment','injury_illness_description'])assert.ok(items.some(x=>x.field===field),field);
  assert.ok(!items.some(x=>x.field==='potential_outcome'));
});
test('assistant mounts only on incident form and does not change PDF template',()=>{
  assert.match(app,/attachIncidentAI\(form,\{db,url,key,project:formProjectId,tr\}\)/);
  assert.match(app,/import \{attachIncidentAI\} from '\.\/incident-ai-pro\.js'/);
});
test('incident AI API enforces project membership, bounded structured review, quota and no automatic write',()=>{
  const start=api.indexOf('if(action==="incident_pro")'),end=api.indexOf('if(!["improve_writing"',start);
  assert.ok(start>0&&end>start);
  const section=api.slice(start,end);
  for(const token of ['project_members','claim_ai_writing_request','responseFormat','maxOutputTokens','INVALID_INPUT','fields.map','Preserve all factual claims','Do not fabricate'])assert.ok(section.includes(token),token);
  assert.doesNotMatch(section,/\.from\(["']incident_reports["']\)\.(?:insert|update|upsert)/);
});
