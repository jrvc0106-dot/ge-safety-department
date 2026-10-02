import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TOOL_DEFINITIONS,canCreateTool,canReadTool,parseQrValue,summarizeProjects,toolReportHtml} from '../src/safety-tools-model.js';
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
test('all six reports retain G&E original asset, By G&E title and escape content',()=>{
 for(const kind of Object.keys(TOOL_DEFINITIONS)){
  const html=toolReportHtml({kind,report_number:'TEST',created_at:'2026-10-01T12:00:00Z',payload:{topic:'<script>bad</script>',description:'<img onerror=x>',summary:[],signatures:[{name:'<script>x</script>',image:'javascript:alert(1)'}]}},{name:'<b>project</b>'});
  assert.ok(html.includes('/ge-logo.png'));assert.ok(html.includes('By G&amp;E'));assert.ok(html.includes('ge-reference-jha'));
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('src="javascript:'));assert.ok(!html.includes('<b>project</b>'));
 }
});
test('director summary keeps projects independent and excludes closed high priority from open high',()=>{
 const rows=summarizeProjects([{id:'a',name:'A'},{id:'b',name:'B'}],[{project_id:'a',status:'open',priority:'high'},{project_id:'a',status:'closed',priority:'high'},{project_id:'b',status:'pending_verification',priority:'low'}]);
 assert.deepEqual(rows,[{project:'A',open:1,review:0,closed:1,high:1},{project:'B',open:0,review:1,closed:0,high:0}]);
});
test('new home links expose authorized tools without an administration link for worker',()=>{
 const admin=toolsHomeMarkup('admin',x=>x),worker=toolsHomeMarkup('worker',x=>x);
 assert.equal((admin.match(/data-safety-tool=/g)||[]).length,6);assert.ok(!worker.includes('data-safety-tool="director"'));assert.ok(worker.includes('data-safety-tool="hazard"'));
});
test('late tool list response cannot overwrite a different project',async()=>{
 let resolve;const gate=new Promise(r=>resolve=r);let current=true,frames=0;
 const chain=new Proxy({}, {get:(_,k)=>k==='then'?gate.then.bind(gate):()=>chain});
 const tools=createSafetyTools({db:{from:()=>chain},state:{profile:{role:'admin'},project:'a'},tr:x=>x,frame:()=>frames++,captureView:()=>()=>current});
 const p=tools.list('toolbox');current=false;resolve({data:[],error:null});await p;assert.equal(frames,0);
});
