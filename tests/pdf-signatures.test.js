import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {jhaSignaturesReport} from '../src/jha-signatures.js';
import {reportSignaturesReport} from '../src/report-signatures.js';
import {attendanceReport} from '../src/report-attendance.js';
import {rasterizePdfSignatures} from '../src/pdf-signatures.js';
const png='data:image/png;base64,iVBORw0KGgo=';
const approvals={safety:{name:'Assigned Safety',strokes:[[[.1,.2],[.3,.4]]]},foreman:{name:'Foreman',strokes:[[[.5,.6]]]},superintendent:{name:'Superintendent',strokes:[[[.7,.8],[.9,1]]]},employee:{name:'Worker',strokes:[[[.2,.3],[.4,.5]]]}};
function fixture(html){
 const dom=new JSDOM('<article>'+html+'</article>'),draws=[],surfaces=[];
 dom.window.HTMLCanvasElement.prototype.getContext=function(){surfaces.push(this);return {beginPath(){},moveTo:(...p)=>draws.push(['move',...p]),lineTo:(...p)=>draws.push(['line',...p]),arc:(...p)=>draws.push(['dot',...p]),fill(){},stroke(){}}};
 dom.window.HTMLCanvasElement.prototype.toDataURL=()=>png;
 const report=dom.window.document.querySelector('article');for(const img of report.querySelectorAll('img'))img.decode=async()=>{};
 return {dom,report,draws,surfaces};
}
for(const [kind,html] of [['JHA',jhaSignaturesReport(approvals,x=>x)],['Equipment',reportSignaturesReport('equipment',approvals,x=>x)],['Incident',reportSignaturesReport('incident',approvals,x=>x)],['Toolbox participants',attendanceReport([{name:'Participant',strokes:approvals.safety.strokes}],x=>x)]])test(`${kind}: PDF receives PNG signatures even when SVG rendering is unavailable`,async()=>{
 const t=fixture(html),text=t.report.textContent,images=[...t.report.querySelectorAll('img')],classes=images.map(i=>i.className);
 assert.ok(images.every(i=>i.src.startsWith('data:image/svg+xml')));
 const count=await rasterizePdfSignatures(t.report);assert.equal(count,images.length);assert.ok(images.every(i=>i.src.startsWith('data:image/png;base64,')));
 assert.equal(t.report.textContent,text);assert.deepEqual(images.map(i=>i.className),classes);assert.ok(t.draws.length);assert.ok(t.surfaces.every(c=>c.width===0&&c.height===0));t.dom.window.close();
});
test('finger/pen strokes and single-point marks retain their exact recorded coordinates',async()=>{
 const t=fixture(jhaSignaturesReport(approvals,x=>x));await rasterizePdfSignatures(t.report);
 assert.ok(t.draws.some(p=>p[0]==='move'&&p[1]===90&&p[2]===60));assert.ok(t.draws.some(p=>p[0]==='line'&&p[1]===270&&p[2]===120));t.dom.window.close();
 const dot=fixture(reportSignaturesReport('equipment',approvals,x=>x));await rasterizePdfSignatures(dot.report);assert.ok(dot.draws.some(p=>p[0]==='dot'&&p[1]===450&&p[2]===180));dot.dom.window.close();
});
test('export waits for PNG decoding before the PDF renderer receives the signature',async()=>{
 const t=fixture(attendanceReport([{name:'Participant',strokes:approvals.safety.strokes}],x=>x));let release,complete=false;
 t.report.querySelector('img').decode=()=>new Promise(resolve=>release=resolve);
 const pending=rasterizePdfSignatures(t.report).then(()=>complete=true);await Promise.resolve();assert.equal(complete,false);release();await pending;assert.equal(complete,true);t.dom.window.close();
});
test('an unsigned report retains its blank signature spaces',async()=>{
 const t=fixture(jhaSignaturesReport({safety:{name:'Name only'}},x=>x)),before=t.report.innerHTML;assert.equal(await rasterizePdfSignatures(t.report),0);assert.equal(t.report.innerHTML,before);t.dom.window.close();
});
test('encoder failure stops export instead of silently dropping a signature',async()=>{
 const t=fixture(jhaSignaturesReport(approvals,x=>x));t.dom.window.HTMLCanvasElement.prototype.toDataURL=()=> 'data:,';
 await assert.rejects(rasterizePdfSignatures(t.report),/saved digital signature/);assert.ok(t.surfaces.every(c=>c.width===0&&c.height===0));t.dom.window.close();
});
