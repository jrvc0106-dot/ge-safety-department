import {test} from 'node:test';import assert from 'node:assert/strict';
import {attachJhaPdfActions} from '../src/jha-pdf-actions.js';
import {renderPaginatedPdf} from '../src/pdf-export.js';
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(run=async()=>{},{includeView=true}={}){
 const actionsList=includeView?['view','download','share']:['download','share'];
 const buttons=Object.fromEntries(actionsList.map(action=>[action,{disabled:false,textContent:action,events:{},addEventListener(name,listener){this.events[name]=listener}}]));
 const actions={querySelector:selector=>buttons[selector.replace('.pdf-','')]},report={dataset:{}};let idle,current=true,warmCalls=0,turns=0;
 attachJhaPdfActions(actions,report,{run,warm:async()=>{warmCalls++},isCurrent:()=>current,scheduleIdle:task=>idle=task,nextTurn:async()=>{turns++},progressText:(page,total)=>`Preparing PDF ${page}/${total}`});
 return {buttons,report,idle:()=>idle(),leave:()=>current=false,get warmCalls(){return warmCalls},get turns(){return turns}};
}
test('opening JHA only preloads dependencies once and never generates a PDF',async()=>{
 let generated=0;const t=setup(async()=>generated++);assert.equal(t.warmCalls,0);await t.idle();await t.buttons.view.events.pointerenter();await t.buttons.share.events.focus();assert.equal(t.warmCalls,1);assert.equal(generated,0);
});
test('JHA final report keeps download and share actions without a view control',async()=>{
 const calls=[],t=setup(async action=>calls.push(action),{includeView:false});
 assert.deepEqual(Object.keys(t.buttons),['download','share']);
 await t.buttons.download.onclick({currentTarget:t.buttons.download});
 await t.buttons.share.onclick({currentTarget:t.buttons.share});
 assert.deepEqual(calls,['download','share']);
});
test('scheduled JHA preload is skipped after leaving the report',async()=>{
 const t=setup();t.leave();await t.idle();assert.equal(t.warmCalls,0);
});
test('JHA preload retries after a temporary network failure',async()=>{
 let idle,calls=0;const button={addEventListener(){}};attachJhaPdfActions({querySelector:()=>button},{dataset:{}},{run:async()=>{},warm:async()=>{if(++calls===1)throw Error('offline')},isCurrent:()=>true,scheduleIdle:task=>idle=task,nextTurn:async()=>{},progressText:()=>''});
 await idle();await idle();assert.equal(calls,2);
});
for(const action of ['view','download','share']){
 test(`JHA ${action} executes in the original click and blocks concurrent actions`,async()=>{
  const gate=deferred(),calls=[];const t=setup((kind,button)=>{calls.push([kind,button]);return gate.promise});const event={currentTarget:t.buttons[action]};
  const pending=t.buttons[action].onclick(event);assert.equal(calls.length,1);assert.equal(calls[0][0],action);assert.equal(calls[0][1],t.buttons[action]);assert.ok(Object.values(t.buttons).every(button=>button.disabled));
  await t.buttons.share.onclick({currentTarget:t.buttons.share});assert.equal(calls.length,1);await t.report.jhaPdfProgress(2,12);assert.equal(t.buttons[action].textContent,'Preparing PDF 2/12');assert.equal(t.turns,1);
  gate.resolve();await pending;assert.ok(Object.values(t.buttons).every(button=>!button.disabled));assert.equal(t.report.jhaPdfProgress,undefined);
 });
}
test('JHA action failure restores all three controls for retry',async()=>{
 const t=setup(async()=>{throw Error('offline')});await assert.rejects(t.buttons.download.onclick({currentTarget:t.buttons.download}),/offline/);assert.ok(Object.values(t.buttons).every(button=>!button.disabled));assert.equal(t.report.jhaPdfProgress,undefined);
});
test('JHA progress stops updating a report after navigating away',async()=>{
 const gate=deferred(),t=setup(()=>gate.promise);const pending=t.buttons.view.onclick({currentTarget:t.buttons.view});t.leave();await t.report.jhaPdfProgress(3,10);assert.equal(t.buttons.view.textContent,'view');gate.resolve();await pending;
});
test('JHA progress yields after each released canvas while preserving 300 DPI and page layout',async()=>{
 const canvases=[],images=[],progress=[];let pages=1;
 class Pdf{addPage(){pages++}addImage(...args){images.push(args)}output(){return new Blob(['pdf'])}}
 const options={jsPDF:{unit:'in',format:'letter'},margin:[.25,.25,.3,.25],html2canvas:{useCORS:true},onPageRendered:async(page,total)=>{progress.push([page,total]);assert.ok(canvases.every(canvas=>canvas.width===0&&canvas.height===0))}};
 const render=async(_,opts)=>{assert.equal(opts.scale,300/96);const canvas={width:2400,height:Math.ceil(opts.height*opts.scale),toDataURL:()=> 'data:image/jpeg;base64/test'};canvases.push(canvas);return canvas};
 await renderPaginatedPdf({scrollHeight:2106},{inner:{width:8,px:{height:1003}}},options,render,Pdf);assert.equal(pages,3);assert.deepEqual(progress,[[1,3],[2,3],[3,3]]);assert.deepEqual(images.map(image=>image[5]),[1003/96,1003/96,100/96]);
});
