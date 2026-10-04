import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TOOL_DEFINITIONS,TRAINING_TYPE_GROUPS,canCreateTool,canReadTool,parseQrValue,summarizeProjects,toolReportHtml,trainingTypeLabel} from '../src/safety-tools-model.js';
import {createSafetyTools,toolsHomeMarkup} from '../src/safety-tools.js';
test('worker can report hazards and read emergency plans but cannot see director or employee lookup',()=>{
 assert.equal(canCreateTool('hazard','worker'),true);assert.equal(canReadTool('emergency','worker'),true);
 for(const k of ['qr','director']){assert.equal(canReadTool(k,'worker'),false);assert.equal(canCreateTool(k,'worker'),false)}
 assert.equal(canCreateTool('emergency','supervisor'),false);assert.equal(canCreateTool('toolbox','supervisor'),true);
});
test('QR accepts only an identifier, G&E payload or canonical site URL; never follows external URLs',()=>{
 assert.deepEqual(parseQrValue(' ge-012 '),{type:'employee',value:'GE-012'});
 assert.deepEqual(parseQrValue('GE:EQUIPMENT:FL-001'),{type:'equipment',value:'FL-001'});
 assert.deepEqual(parseQrValue('https://ge-safety-department.vercel.app/?sticker=GE123'),{type:'employee',value:'GE123'});
 for(const bad of ['javascript:alert(1)','https://evil.example/?sticker=GE123','<img onerror=x>',''])assert.throws(()=>parseQrValue(bad));
});
test('all safety tool reports retain G&E original asset, By G&E title and escape content',()=>{
 for(const kind of Object.keys(TOOL_DEFINITIONS)){
  const html=toolReportHtml({kind,report_number:'TEST',created_at:'2026-10-01T12:00:00Z',payload:{topic:'<script>bad</script>',description:'<img onerror=x>',summary:[],signatures:[{name:'<script>x</script>',image:'javascript:alert(1)'}]}},{name:'<b>project</b>'});
  assert.ok(html.includes('/ge-logo.png'));assert.ok(html.includes('By G&amp;E'));assert.ok(html.includes('ge-reference-jha'));
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('src="javascript:'));assert.ok(!html.includes('<b>project</b>'));
 }
});
test('training record has practical construction training options and a structured bilingual PDF section',()=>{
 assert.equal(canCreateTool('training','safety'),true);assert.equal(canCreateTool('training','worker'),false);
 const types=TRAINING_TYPE_GROUPS.flatMap(group=>group.options.map(([value])=>value));
 for(const type of ['mot','flagger','forklift','heavy_equipment','fall_protection','excavation','other'])assert.ok(types.includes(type));
 assert.equal(trainingTypeLabel('forklift',(en,es)=>es),'Operador de montacargas');
 const html=toolReportHtml({kind:'training',report_number:'TR-1',created_at:'2026-10-01T12:00:00Z',payload:{training_type:'flagger',training_date:'2026-10-01',duration:'30',instructor:'<script>bad</script>',topics:'MUTCD Part 6\nWork-zone signals',applicable_standard:'OSHA 1926.201 / MUTCD Part 6',evaluation:'Demonstrated safe STOP/SLOW signaling',result:'completed',attendance_signatures:[{name:'Crew Member',strokes:[]}],approvals:{safety:{name:'Safety Lead',strokes:[]},foreman:{name:'Foreman',strokes:[]}}}},{name:'Project'});
 assert.match(html,/Training record/);assert.match(html,/Work-zone signals/);assert.match(html,/Flagger \/ Work Zone Flagger/);assert.match(html,/Completed/);assert.match(html,/Crew Member/);assert.doesNotMatch(html,/<script>/);
});
test('medical follow-up is limited to admin and safety director and produces a confidential employee timeline report',()=>{
 assert.equal(canCreateTool('medical_followup','admin'),true);assert.equal(canReadTool('medical_followup','safety_director'),true);
 for(const role of ['safety','supervisor','worker']){assert.equal(canReadTool('medical_followup',role),false);assert.equal(canCreateTool('medical_followup',role),false)}
 const html=toolReportHtml({kind:'medical_followup',report_number:'MF-20261004-ABC12345',created_at:'2026-10-04T10:00:00Z',payload:{employee_name:'Case Worker',last_appointment_date:'2026-10-02',next_appointment_date:'2026-10-09',current_condition_summary:'Recovering; reports improving mobility',reported_medications:'Employee-reported medication',event_type:'work_status_received',case_status:'restrictions_active',work_status:'temporary_restrictions',next_followup_date:'2026-10-06',clearance_received:false,work_restrictions_summary:'No ladder work',timeline:[{employee_name:'Case Worker',event_date:'2026-10-04',last_appointment_date:'2026-10-02',next_appointment_date:'2026-10-09',current_condition_summary:'Recovering; reports improving mobility',reported_medications:'Employee-reported medication',event_type:'work_status_received',case_status:'restrictions_active',work_status:'temporary_restrictions',next_followup_date:'2026-10-06'}]}},{name:'Project'});
 assert.match(html,/CONFIDENTIAL/);assert.match(html,/Follow-up timeline/);assert.match(html,/No ladder work/);assert.match(html,/Case Worker/);assert.match(html,/2026-10-02/);assert.match(html,/2026-10-09/);assert.match(html,/improving mobility/);assert.match(html,/Employee-reported medication/);assert.match(html,/diagnosis, dosage/);assert.doesNotMatch(html,/Signatures \/ acknowledgment/);assert.doesNotMatch(html,/<script>/);
});
test('director summary keeps projects independent and excludes closed high priority from open high',()=>{
 const rows=summarizeProjects([{id:'a',name:'A'},{id:'b',name:'B'}],[{project_id:'a',status:'open',priority:'high'},{project_id:'a',status:'closed',priority:'high'},{project_id:'b',status:'pending_verification',priority:'low'}]);
 assert.deepEqual(rows,[{project:'A',open:1,review:0,closed:1,high:1},{project:'B',open:0,review:1,closed:0,high:0}]);
});
test('new home links expose authorized tools without an administration link for worker',()=>{
 const admin=toolsHomeMarkup('admin',x=>x),worker=toolsHomeMarkup('worker',x=>x);
 assert.equal((admin.match(/data-safety-tool=/g)||[]).length,8);assert.ok(admin.includes('data-safety-tool="training"'));assert.ok(admin.includes('data-safety-tool="medical_followup"'));assert.ok(!worker.includes('data-safety-tool="medical_followup"'));assert.ok(!worker.includes('data-safety-tool="director"'));assert.ok(worker.includes('data-safety-tool="hazard"'));
});
