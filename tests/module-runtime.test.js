import {reportApprovals,reportSignaturesReport} from '../src/report-signatures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {jhaSignatureFields,jhaApprovals} from '../src/jha-signatures.js';
import {parseAst} from 'rollup/parseAst';
import {createImageCache,createTaskQueue} from '../src/image-cache.js';
import {effectiveWalkStatus} from '../src/daily-walk-report-status.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
function fn(name){const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.ok(node,name);return source.slice(node.start,node.end)}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const [statuses,score] of [[['safe','safe','safe','unsafe','na',null],75],[['unsafe','unsafe','na'],0],[['safe','safe','na'],100]]){
 test('JHA report preserves Unsafe findings and displays '+score+'% for '+statuses.join(', '),async()=>{
  const frames=[],items=statuses.map((status,i)=>({status,category:'Category '+i,item_text:'Check '+i,sort_order:i,hazard:status==='unsafe'?'Original hazard '+i:null,correction:status==='unsafe'?'Documented action '+i:null,photos:[]}));
  const state={session:{user:{id:'user'}},profile:{id:'user'},project:'job',page:'safetyWalkReport',detail:'walk',lang:'en',projects:[{id:'job',name:'Job'}]};
  const query={select(){return this},eq(){return this},order(){return this},limit:async()=>({data:[]}),single:async()=>({data:{id:'walk',project_id:'job',created_at:'2026-10-02T12:00:00Z',overall_status:'safe',items,creator:{name:'Safety'}}})};
  const context=vm.createContext({state,effectiveWalkStatus,db:{from:()=>query},frame:html=>frames.push(html),document:{querySelector:()=>({})},back(){},tr:x=>x,esc:x=>x,localDateKey:()=> '2026-10-02',console,error:err=>{throw err}});
  vm.runInContext('let renderRevision=0;'+fn('captureView')+'\n'+fn('safetyWalkReport'),context);await context.safetyWalkReport();
  assert.equal(frames.length,1);assert.ok(frames[0].includes('<strong>'+score+'%</strong>'));
  for(const item of items.filter(x=>x.status==='unsafe')){assert.ok(frames[0].includes('ewr-status unsafe'));assert.ok(frames[0].includes(item.hazard));assert.ok(frames[0].includes(item.correction));}
 });
}
test('image requests are shared, reused, retried after failure and expired',async()=>{
 let clock=0,calls=0;const cache=createImageCache({now:()=>clock});const gate=deferred(),load=()=>{calls++;return gate.promise};
 const first=cache.get('photo',load,100),second=cache.get('photo',load,100);assert.equal(first,second);await tick();assert.equal(calls,1);gate.resolve('blob:photo');await first;
 assert.equal(await cache.get('photo',()=>{throw Error('duplicate')}),'blob:photo');clock=101;assert.equal(await cache.get('photo',async()=> 'blob:new'),'blob:new');
 await assert.rejects(cache.get('bad',async()=>{throw Error('offline')}));assert.equal(await cache.get('bad',async()=> 'blob:recovered'),'blob:recovered');
});
test('cache bounds and cleanup retain currently displayed images',async()=>{
 const revoked=[],cache=createImageCache({limit:2,revoke:url=>revoked.push(url)});
 for(const key of ['a','b','c'])await cache.get(key,async()=> 'blob:'+key);
 await tick();assert.equal(cache.size,2);cache.collect(new Set(['blob:a']));assert.deepEqual(revoked,[]);
 cache.collect();assert.deepEqual(revoked,['blob:a']);cache.reset();await tick();cache.collect();assert.equal(new Set(revoked).size,3);
});
test('image download queue limits concurrency and continues after a failed photo',async()=>{
 const queue=createTaskQueue(2),gates=Array.from({length:5},deferred);let running=0,maximum=0,started=0;
 const tasks=gates.map((gate,i)=>queue(async()=>{started++;running++;maximum=Math.max(maximum,running);try{await gate.promise;if(i===1)throw Error('missing');return i}finally{running--}}));
 const settled=Promise.allSettled(tasks);await tick();assert.equal(started,2);gates[0].resolve();gates[1].resolve();await tick();assert.equal(started,4);gates.forEach(g=>g.resolve());await settled;assert.equal(maximum,2);assert.equal(started,5);
});
for(const name of ['inventoryPage','inventoryReport','safetyWalkReport','observationReport','incidentReportView','equipmentInspectionReport','disciplineReport','reportCenter','notificationsPage']){
 test(`${name} ignores a late response after changing screen or project`,async()=>{
  const gate=deferred(),frames=[],messages=[];const state={session:{user:{id:'user'}},profile:{id:'user',role:'admin'},project:'old',page:name,detail:'record',projects:[{id:'old'}],observations:[]};
  const query=new Proxy({}, {get:(_,key)=>key==='then'?gate.promise.then.bind(gate.promise):()=>query});
  const context=vm.createContext({error(){},reportApprovals,reportSignaturesReport,mountReportSignatures(){},attachAggregateSignatures:async()=>{},enableAutoDraft(){},clearDraft(){},confirmAction(){},state,db:{from:()=>query},document:{querySelector:()=>null},frame:html=>frames.push(html),error:e=>messages.push(e),tr:x=>x,esc:x=>x,console});
  vm.runInContext('let renderRevision=0;'+fn('captureView')+'\n'+fn(name),context);
  const pending=context[name]();state.page='home';state.project='new';gate.resolve({data:[],error:Error('old connection')});await pending;
  assert.equal(frames.length,0);assert.equal(messages.length,0);
 });
}
function draftContext(){
 const state={profile:{id:'owner'},project:'job-a',detail:null},writes=[],local=new Map();
 const context=vm.createContext({error(){},reportApprovals,reportSignaturesReport,mountReportSignatures(){},attachAggregateSignatures:async()=>{},enableAutoDraft(){},clearDraft(){},confirmAction(){},state,db:{from:()=>({upsert:async value=>{writes.push(value);return {error:null}}})},document:{activeElement:null},localStorage:{setItem:(k,v)=>local.set(k,v)},tr:x=>x,console,clearTimeout,setTimeout});
 vm.runInContext(source.slice(source.indexOf('const DRAFT_FORMS='),source.indexOf('const optionalScriptLoads=')),context);
 context.setDraftStatus=()=>{};context.renderDraftFileBadges=()=>{};
 const form={dataset:{autoDraft:'true'},isConnected:false,elements:[{name:'notes',type:'textarea',value:'original report',tagName:'TEXTAREA'}],querySelectorAll:()=>[]};
 return {context,state,writes,local,form};
}
test('debounced draft remains attached to its original owner and jobsite',async()=>{
 const t=draftContext();t.context.draftOwner(t.form,'incident','default');t.state.project='job-b';t.state.profile={id:'another-user'};
 await t.context.persistDraft(t.form,'incident');assert.equal(t.writes[0].project_id,'job-a');assert.equal(t.writes[0].user_id,'owner');assert.equal(t.writes[0].payload.notes,'original report');assert.ok(t.local.has('ge_draft_v1:owner:job-a:incident:default'));
});
test('concurrent draft evidence fields retain both sets of photos after a jobsite change',async()=>{
 const t=draftContext(),gate=deferred(),paths=[];t.context.draftOwner(t.form,'daily_safety_walk','default');
 t.context.normalizeReportImage=async file=>{if(file.name==='first.jpg')await gate.promise;return file};t.context.crypto={randomUUID:()=> String(paths.length)};
 t.context.db.storage={from:()=>({upload:async path=>{paths.push(path);return {}},remove:async()=>({})})};
 const file=name=>({name,type:'image/jpeg',size:10});
 const first=t.context.uploadDraftFiles(t.form,'daily_safety_walk','default',{name:'photos_0',files:[file('first.jpg')]});
 t.state.project='job-b';const second=t.context.uploadDraftFiles(t.form,'daily_safety_walk','default',{name:'photos_1',files:[file('second.jpg')]});await second;gate.resolve();await first;
 const files=t.context.serializeDraftForm(t.form,'daily_safety_walk').__files;assert.equal(files.photos_0.length,1);assert.equal(files.photos_1.length,1);assert.ok(paths.every(path=>path.startsWith('owner/job-a/')));
 await t.context.uploadDraftFiles(t.form,'daily_safety_walk','default',{name:'photos_0',files:[file('third.jpg')]});
 const appended=t.context.serializeDraftForm(t.form,'daily_safety_walk').__files;assert.deepEqual(Array.from(appended.photos_0,x=>x.name),['first.jpg','third.jpg']);assert.equal(appended.photos_1.length,1);
});
test('duplicate form submission invokes one write and restores buttons after failure',async()=>{
 const gate=deferred(),button={disabled:false},messages=[];let saves=0;const form={dataset:{},isConnected:true,querySelectorAll:()=>[button],onsubmit:async()=>{saves++;await gate.promise;throw Error('offline')}};
 const context=vm.createContext({error(){},reportApprovals,reportSignaturesReport,mountReportSignatures(){},attachAggregateSignatures:async()=>{},enableAutoDraft(){},clearDraft(){},confirmAction(){},document:{querySelectorAll:()=>[form]},error:err=>messages.push(err.message)});vm.runInContext(fn('installFormSubmissionGuards'),context);context.installFormSubmissionGuards();
 const event={preventDefault(){}};const first=form.onsubmit(event);await form.onsubmit(event);assert.equal(saves,1);assert.equal(button.disabled,true);gate.resolve();await first;assert.equal(button.disabled,false);assert.deepEqual(messages,['offline']);
});
test('sticker OCR releases its bitmap on success and detector failure',async()=>{
 let closed=0;const context=vm.createContext({error(){},reportApprovals,reportSignaturesReport,mountReportSignatures(){},attachAggregateSignatures:async()=>{},enableAutoDraft(){},clearDraft(){},confirmAction(){},window:{TextDetector:true},createImageBitmap:async()=>({close(){closed++}}),TextDetector:class{async detect(){return [{rawValue:'GE12345'}]}}});vm.runInContext(fn('readStickerNumber'),context);
 assert.equal(await context.readStickerNumber({}),'GE12345');context.TextDetector=class{async detect(){throw Error('unsupported')}};assert.equal(await context.readStickerNumber({}), '');assert.equal(closed,2);
});
for(const checklistStatus of ['safe','unsafe']) test('JHA saves '+checklistStatus+' checklist with Safe overall condition, photos and original jobsite',async()=>{
  const weather=deferred(),save=deferred(),calls=[],paths=[],redirects=[],errors=[],filters=[],button={disabled:false},form={dataset:{},querySelector:()=>button};
  const state={session:{user:{id:'user'}},profile:{id:'user',role:'admin'},project:'job-a',page:'safetyWalk',projects:[{id:'job-a',name:'A'}]};
  const items=Array.from({length:40},(_,i)=>['Category '+i,'Check '+i]);
  const db={from(table){let payload;const q={insert(value){payload=value;calls.push({table,payload});return q},update(value){payload=value;calls.push({table,payload,update:true});return q},eq(column,value){filters.push({table,column,value});return q},select(){return q},single:async()=>{await save.promise;return {data:{id:'walk'}}},then(resolve,reject){return Promise.resolve({data:table==='daily_safety_walk_items'?payload.map(item=>({id:'item-'+item.sort_order,sort_order:item.sort_order})).reverse():null,error:null}).then(resolve,reject)}};return q},storage:{from:()=>({upload:async path=>{paths.push(path);return {}},remove:async()=>({})})}};
  const context=vm.createContext({error(){},reportApprovals,reportSignaturesReport,mountReportSignatures(){},attachAggregateSignatures:async()=>{},enableAutoDraft(){},clearDraft(){},confirmAction(){},state,db,document:{querySelector:()=>form},SAFETY_WALK_ITEMS:items,jhaSignatureFields,jhaApprovals,attachJhaSignatures(){},attachJhaDictation(){},attachJhaReview(){},frame(){},tr:x=>x,esc:x=>x,fmt:()=>'',FormData:class{get(name){return name==='jha_safety_name'?'Safety A':name==='jha_superintendent_name'?'Superintendent B':name==='jha_safety_signature'?'[[[0.1,0.2],[0.4,0.5]]]':name==='jha_superintendent_signature'?'[[[0.6,0.7]]]':name==='overall_status'?'safe':name.startsWith('status_')?checklistStatus:''}},draftFilesFor:async(_,__,___,name)=>name==='photos_2'?[{type:'image/jpeg',size:10,name:'photo.jpg'}]:[],captureJobsiteWeather:()=>weather.promise,normalizeReportImage:async file=>file,crypto:{randomUUID:()=> 'uuid'},clearDraft:async(...args)=>assert.equal(args[2],form),savedAction(){},navigate:(...args)=>redirects.push(args),error:err=>errors.push(err)});
  vm.runInContext('let renderRevision=0;'+fn('captureView')+'\n'+fn('safetyWalk'),context);await context.safetyWalk();const pending=form.onsubmit({preventDefault(){},target:form});await tick();state.project='job-b';state.page='home';weather.resolve({condition_code:1});save.resolve();await pending;await tick();
  assert.deepEqual(errors,[]);const saved=calls.find(x=>x.table==='daily_safety_walks'&&!x.update).payload;assert.equal(saved.project_id,'job-a');assert.equal(saved.weather_snapshot,null);assert.equal(saved.approvals.safety.name,'Safety A');assert.equal(saved.approvals.superintendent.name,'Superintendent B');assert.deepEqual(saved.approvals.safety.strokes,[[[.1,.2],[.4,.5]]]);assert.deepEqual(saved.approvals.superintendent.strokes,[[[.6,.7]]]);const checklist=calls.filter(x=>x.table==='daily_safety_walk_items');assert.equal(checklist.length,1);assert.equal(checklist[0].payload.length,40);assert.equal(saved.overall_status,'safe');assert.ok(checklist[0].payload.every(item=>item.status===checklistStatus));assert.equal(button.disabled,false);assert.equal(form.dataset.submitting,undefined);assert.equal(paths.length,1);assert.ok(paths[0].startsWith('walk/item-2/'));assert.deepEqual(redirects,[]);
  const lateUpdate=calls.find(x=>x.table==='daily_safety_walks'&&x.update);assert.deepEqual(lateUpdate.payload.weather_snapshot,{condition_code:1});assert.ok(filters.some(x=>x.table==='daily_safety_walks'&&x.column==='id'&&x.value==='walk'));assert.ok(filters.some(x=>x.table==='daily_safety_walks'&&x.column==='project_id'&&x.value==='job-a'));
});
test('clearing a submitted draft removes only that form owner’s draft after navigating away',async()=>{
 const t=draftContext(),filters=[],removed=[];t.context.draftOwner(t.form,'incident','default');t.state.project='job-b';t.state.profile={id:'another'};
 const query={select(){return this},delete(){return this},eq(column,value){filters.push([column,value]);return this},maybeSingle:async()=>({data:null}),then(resolve){return Promise.resolve({}).then(resolve)}};
 t.context.db.from=()=>query;t.context.localStorage.removeItem=k=>removed.push(k);t.context.document.getElementById=()=>null;
 await t.context.clearDraft('incident','default',t.form);assert.ok(filters.some(([key,value])=>key==='project_id'&&value==='job-a'));assert.ok(filters.some(([key,value])=>key==='user_id'&&value==='owner'));assert.ok(!filters.some(([,value])=>value==='job-b'||value==='another'));assert.deepEqual(removed,['ge_draft_v1:owner:job-a:incident:default']);
});
test('daily report batches related queries and remains nonexportable until rows finish',async()=>{
 const gate=deferred(),queries=[],sections=[],report={dataset:{}},box={innerHTML:'',append:section=>sections.push(section)},back={};
 const rows=['one','two'].map(id=>({id,project_id:'job',created_at:'2026-09-30T12:00:00Z',area:id,category:'Safety',description:'Hazard',priority:'high',status:'open'}));
 const state={session:{user:{id:'user'}},profile:{id:'user',name:'Inspector'},project:'job',page:'report',projects:[{id:'job'}],observations:rows,lang:'en'};
 const db={from(table){const query={select(){return this},in(column,ids){queries.push({table,column,ids});return this},order(){return this},then(resolve,reject){return gate.promise.then(()=>({data:table==='observation_photos'?[{observation_id:'two',path:'photo',kind:'before'}]:[]})).then(resolve,reject)}};return query}};
 const context=vm.createContext({error(){},reportApprovals,reportSignaturesReport,mountReportSignatures(){},attachAggregateSignatures:async()=>{},enableAutoDraft(){},clearDraft(){},confirmAction(){},state,db,document:{querySelector:selector=>selector==='#back'?back:selector==='#report-rows'?box:report,createElement:()=>({})},frame(){},back(){},localDateKey:()=> '2026-09-30',photoUrl:async()=>({data:{signedUrl:'blob:photo'}}),tr:x=>x,esc:x=>x,fmt:x=>x,Intl});
 vm.runInContext('let renderRevision=0;'+fn('captureView')+'\n'+fn('report'),context);const pending=context.report();await tick();assert.equal(report.dataset.loading,'true');assert.equal(queries.length,2);assert.equal(queries[0].ids.length,2);gate.resolve();await pending;assert.equal(sections.length,2);assert.equal(report.dataset.loading,'false');assert.ok(!sections[0].innerHTML.includes('blob:photo'));assert.ok(sections[1].innerHTML.includes('blob:photo'));
});
test('report date filters use original timestamps for both English and Spanish display dates',()=>{
 let rowNode;function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id.name==='row'&&n.params.some(p=>p.name==='timestamp'||p.left?.name==='timestamp'))rowNode=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}walk(ast);assert.ok(rowNode);
 const context=vm.createContext({error(){},reportApprovals,reportSignaturesReport,mountReportSignatures(){},attachAggregateSignatures:async()=>{},enableAutoDraft(){},clearDraft(){},confirmAction(){},esc:x=>x,docMeta:()=>'',tr:x=>x});vm.runInContext(source.slice(rowNode.start,rowNode.end),context);const timestamp='2026-09-30T15:00:00Z';
 for(const lang of ['en-US','es-US']){const displayed=new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'short'}).format(new Date(timestamp)),html=context.row('walk','x','Walk',displayed,'safe','daily_safety_walk',timestamp);assert.ok(html.includes(`data-time="${new Date(timestamp).getTime()}"`));assert.ok(html.includes(displayed));}
});
