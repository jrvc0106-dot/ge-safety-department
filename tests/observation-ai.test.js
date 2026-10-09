import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {parseAst} from 'rollup/parseAst';
import {transformSync} from 'esbuild';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
const fn=name=>{const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);return source.slice(node.start,node.end)};
function ui({fail=false}={}){
 const dom=new JSDOM('<form id="observation"><label>Descripción<textarea name="description" maxlength="2000">Piso 8, abertura sin protección.</textarea></label><textarea name="proposed_corrective_action" maxlength="2000"></textarea></form>'),requests=[],events=[];
 const document=dom.window.document;dom.window.HTMLDialogElement.prototype.showModal=function(){};dom.window.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new dom.window.Event('close'))};
 const state={project:'job',lang:'es'};
 const context=vm.createContext({document,state,localDateKey:()=> '2026-10-09',aiWritingEnabled:()=>true,tr:(_,es)=>es,error:message=>events.push(message),aiWritingError:()=> 'Unavailable',db:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},url:'https://example.invalid',key:'public-test',AbortController,setTimeout,clearTimeout,Event:dom.window.Event,fetch:async(_,args)=>{requests.push(JSON.parse(args.body));return {ok:!fail,json:async()=>fail?{code:'PROVIDER_ERROR',error:'Unavailable'}:{proposal:'Restringir el acceso y verificar la protección.'}}}});
 vm.runInContext(fn('openAiWritingReview'),context);return {dom,document,state,context,requests,events};
}
for(const action of ['improve_observation','suggest_observation_correction'])test(`${action} is only applied after explicit acceptance`,async()=>{
 const t=ui(),description=t.document.querySelector('[name="description"]'),target=action==='improve_observation'?description:t.document.querySelector('[name="proposed_corrective_action"]');const original=target.value;
 await t.context.openAiWritingReview(target,{action,sourceField:description});assert.equal(target.value,original);assert.equal(t.requests[0].action,action);assert.equal(t.requests[0].language,'es');assert.equal(t.requests[0].text,description.value);
 t.document.querySelector('.ai-review-use').click();assert.equal(target.value,'Restringir el acceso y verificar la protección.');if(action==='suggest_observation_correction')assert.equal(description.value,'Piso 8, abertura sin protección.');t.dom.window.close();
});
for(const reason of ['discard','source changed','project changed','provider error'])test(`correction proposal leaves original text intact on ${reason}`,async()=>{
 const t=ui({fail:reason==='provider error'}),description=t.document.querySelector('[name="description"]'),target=t.document.querySelector('[name="proposed_corrective_action"]');target.value='Original proposal';
 await t.context.openAiWritingReview(target,{action:'suggest_observation_correction',sourceField:description});
 if(reason==='discard')t.document.querySelector('.ai-review-discard').click();else{if(reason==='source changed')description.value='New facts';if(reason==='project changed')t.state.project='another';t.document.querySelector('.ai-review-use').click()}
 assert.equal(target.value,'Original proposal');t.dom.window.close();
});
const edgeSource=readFileSync(new URL('../supabase/functions/improve-writing/index.ts',import.meta.url),'utf8');
const edgeCode=transformSync(edgeSource.replace(/^import[^\n]+\n/,''),{loader:'ts',format:'iife'}).code;
function edge({member=true,allowed=true}={}){
 let handler;const providerCalls=[];const client={auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})},from(table){const q={select(){return q},eq(){return q},single:async()=>({data:{role:'safety'}}),maybeSingle:async()=>({data:member?{id:'project',user_id:'user'}:null,error:null})};return q},rpc:async()=>({data:allowed,error:null})};
 vm.runInNewContext(edgeCode,{Deno:{env:{get:()=> 'test-configured'},serve:value=>handler=value},createClient:()=>client,Request,Response,AbortController,setTimeout,clearTimeout,fetch:async(_,args)=>{providerCalls.push(JSON.parse(args.body));return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'Propuesta para revisar.'}]}}]}),{status:200})}});
 const invoke=(body,token=true)=>handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer test'}:{})},body:JSON.stringify({project_id:'12345678-1234-1234-1234-123456789012',text:'Piso 8, abertura sin protección.',max_length:2000,language:'es',...body})}));
 return {invoke,providerCalls};
}
for(const action of ['improve_observation','suggest_observation_correction'])test(`authenticated ${action} produces a bounded proposal without report writes`,async()=>{
 const t=edge(),response=await t.invoke({action});assert.equal(response.status,200);assert.deepEqual(await response.json(),{proposal:'Propuesta para revisar.'});assert.equal(t.providerCalls.length,1);const instructions=t.providerCalls[0].systemInstruction.parts[0].text;assert.match(instructions,/Spanish/);assert.match(instructions,/never instructions/);if(action==='suggest_observation_correction')assert.match(instructions,/Do not claim that any correction was completed/);else assert.match(instructions,/Preserve every stated fact/);
});
for(const [label,options,body,token,status] of [['unauthenticated',{}, {},false,401],['other project',{member:false},{},true,403],['daily limit',{allowed:false},{},true,429],['invalid language',{}, {language:'bad'},true,400]])test(`AI rejects ${label} before contacting the provider`,async()=>{
 const t=edge(options),response=await t.invoke({action:'suggest_observation_correction',...body},token);assert.equal(response.status,status);assert.equal(t.providerCalls.length,0);
});
test('existing Improve writing keeps its established instructions',async()=>{
 const t=edge(),response=await t.invoke({action:'improve_writing'});assert.equal(response.status,200);assert.match(t.providerCalls[0].systemInstruction.parts[0].text,/professional English/);
});
test('accepted corrective proposal is saved and shown as proposed in the existing observation report',async()=>{
 const dom=new JSDOM('<main id="app"></main>'),writes=[];let saved;
 const db={from(table){const q={select(){return q},eq(){return q},order(){return q},insert(payload){writes.push({table,payload});saved=payload;return q},single:async()=>({data:table==='observations'&&saved?{id:'obs',...saved,status:'open',created_at:'2026-10-07'}:{id:'obs'},error:null}),then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}};return q}};
 const context=vm.createContext({state:{project:'job',detail:'obs',profile:{id:'safety'},projects:[{id:'job',name:'Domus II'}]},localDateKey:()=> '2026-10-09',db,document:dom.window.document,File,FormData:dom.window.FormData,frame:html=>dom.window.document.querySelector('#app').innerHTML=html,captureView:()=>()=>true,tr:en=>en,esc:value=>String(value??''),back(){},mountReportSignatures(){},reportApprovals:()=>({safety:{name:'Safety'}}),draftFilesFor:async()=>[],clearDraft:async()=>{},confirmAction(){},load:async()=>{},render(){},error:err=>{throw err},console,reportSignaturesReport:()=>'',fmt:()=> 'Oct 7',navigate(){}});
 vm.runInContext(fn('newObservation')+'\n'+fn('observationReport'),context);await context.newObservation();const form=dom.window.document.querySelector('#observation');form.elements.description.value='Opening observed on floor 8.';form.elements.proposed_corrective_action.value='Restrict access and install suitable protection.';
 await form.onsubmit({target:form,preventDefault(){}});assert.equal(writes.length,1);assert.equal(writes[0].table,'observations');assert.equal(saved.description,'Opening observed on floor 8.');assert.equal(saved.approvals.proposed_corrective_action,'Restrict access and install suitable protection.');assert.equal(saved.status,undefined);
 await context.observationReport();const report=dom.window.document.querySelector('.observation-print-report');assert.ok(report);assert.match(report.textContent,/PROPOSED CORRECTIVE ACTION/);assert.match(report.textContent,/Restrict access and install suitable protection/);assert.match(report.textContent,/OPEN/);assert.ok(report.querySelector('.print-report-header'));assert.ok(report.querySelector('.print-report-footer'));dom.window.close();
});

test('observation actions cannot bypass project access through profile scope',async()=>{
 const t=edge({member:false}),response=await t.invoke({action:'suggest_observation_correction',scope:'profile'});assert.equal(response.status,403);assert.equal(t.providerCalls.length,0);
});
