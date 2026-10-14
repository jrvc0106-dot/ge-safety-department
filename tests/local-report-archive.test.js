import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeReportArchiveAvailable,saveLocalReport,listLocalReports,openLocalReport} from '../src/local-report-archive.js';

const smallPdf=()=>new Blob(['%PDF-1.7\nExample PDF body'],{type:'application/pdf'});
function fixture(){
 const fileMap=new Map(),memory=new Map(),events={writes:0,mkdir:0,opens:[],fails:false};
 const store={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const fs={
  async mkdir({path,directory,recursive}){assert.equal(directory,'DOCUMENTS');assert.equal(recursive,true);events.mkdir++;assert.ok(path.startsWith('G&E Reports/'))},
  async writeFile({path,data,directory}){assert.equal(directory,'DOCUMENTS');if(events.fails)throw Error('Disk full');events.writes++;fileMap.set(path,Buffer.from(data,'base64'))},
  async stat({path,directory}){assert.equal(directory,'DOCUMENTS');if(!fileMap.has(path))throw Error('File not found');return {size:fileMap.get(path).length}},
  async getUri({path}){return {uri:'file:///Documents/'+encodeURIComponent(path)}}
 };
 class TestReader{
  readAsDataURL(blob){
   blob.arrayBuffer().then(bytes=>{
    this.result='data:application/pdf;base64,'+Buffer.from(bytes).toString('base64');
    this.onload?.();
   },err=>{this.error=err;this.onerror?.()});
  }
 }
 const runtime={FileReader:TestReader,localStorage:store,Capacitor:{
  getPlatform:()=>'ios',isNativePlatform:()=>true,
  Plugins:{Filesystem:fs,Share:{share:async data=>events.opens.push(data)}}
 }};
 return {fileMap,memory,events,runtime};
}
const params={projectId:'proj-1',projectName:'Rivage Bal Harbour',reportType:'disciplinary_action',
 reportNumber:'DISC-0001',sourceId:'disc-1',userId:'staff-1',filename:'Safety Report.pdf',
 fingerprint:'report content one'};
test('web Safari cannot silently write to the iPad Files app',async()=>{
 const f=fixture();
 f.runtime.Capacitor.getPlatform=()=> 'web';
 assert.equal(nativeReportArchiveAvailable(f.runtime),false);
 await assert.rejects(saveLocalReport({...params,blob:smallPdf(),env:f.runtime}),/native iPad app/);
 assert.equal(f.events.writes,0);
});
test('native iPad saves one PDF by project and category, indexing shortcuts without binary data',async()=>{
 const f=fixture();
 assert.equal(nativeReportArchiveAvailable(f.runtime),true);
 const saved=await saveLocalReport({...params,blob:smallPdf(),env:f.runtime});
 assert.equal(saved.indexed,true);
 assert.match(saved.path,/G&E Reports\/Rivage Bal Harbour-[\da-f]{8}\/Disciplinary Actions\/\d{4}-\d{2}\/Safety Report-[\da-f]{8}\.pdf/);
 assert.equal(f.events.writes,1);
 assert.ok(f.fileMap.get(saved.path).toString().startsWith('%PDF-1.7'));
 const items=listLocalReports({userId:'staff-1',projectId:'proj-1',env:f.runtime});
 assert.equal(items.length,1);
 assert.equal(items[0].path,saved.path);
 const storedData=[...f.memory.values()].join(' ');
 assert.doesNotMatch(storedData,/PDF-1.7/);
 assert.doesNotMatch(storedData,/report content one/);
 assert.deepEqual(listLocalReports({userId:'staff-2',env:f.runtime}),[]);
 assert.deepEqual(listLocalReports({userId:'staff-1',projectId:'other',env:f.runtime}),[]);
});
test('same version is not written again; new version overwrites original rather than duplicating',async()=>{
 const f=fixture();
 const first=await saveLocalReport({...params,blob:smallPdf(),env:f.runtime});
 const repeat=await saveLocalReport({...params,blob:smallPdf(),env:f.runtime});
 assert.equal(repeat.alreadySaved,true);
 assert.equal(f.events.writes,1);
 const second=await saveLocalReport({...params,fingerprint:'revised content',blob:new Blob(['%PDF-1.7\nChanged revision'],{type:'application/pdf'}),env:f.runtime});
 assert.equal(f.events.writes,2);
 assert.equal(second.path,first.path);
 assert.equal(f.fileMap.size,1);
 assert.equal(listLocalReports({userId:'staff-1',env:f.runtime}).length,1);
 assert.match(f.fileMap.get(second.path).toString(),/Changed revision/);
});
test('deleted PDF is recreated rather than leaving a broken shortcut',async()=>{
 const f=fixture();
 const first=await saveLocalReport({...params,blob:smallPdf(),env:f.runtime});
 f.fileMap.delete(first.path);
 const next=await saveLocalReport({...params,blob:smallPdf(),env:f.runtime});
 assert.equal(f.events.writes,2);
 assert.equal(next.path,first.path);
});
test('disk-full failure does not create an incorrect shortcut',async()=>{
 const f=fixture();f.events.fails=true;
 await assert.rejects(saveLocalReport({...params,blob:smallPdf(),env:f.runtime}),/Disk full/);
 assert.equal(listLocalReports({userId:'staff-1',env:f.runtime}).length,0);
 assert.equal(f.fileMap.size,0);
});
test('local shortcut opens its original file and fails clearly if removed',async()=>{
 const f=fixture();
 const doc=await saveLocalReport({...params,blob:smallPdf(),env:f.runtime});
 assert.equal(await openLocalReport(doc,{env:f.runtime}),true);
 assert.equal(f.events.opens.length,1);
 assert.match(f.events.opens[0].url,/^file:/);
 f.fileMap.delete(doc.path);
 await assert.rejects(openLocalReport(doc,{env:f.runtime}),/moved or deleted/);
});
test('reject empty or oversized files before any writes',async()=>{
 const f=fixture();
 await assert.rejects(saveLocalReport({...params,blob:new Blob([],{type:'application/pdf'}),env:f.runtime}),/missing, invalid/);
 await assert.rejects(saveLocalReport({...params,blob:new Blob([new Uint8Array(30*1024*1024+1)],{type:'application/pdf'}),env:f.runtime}),/larger/);
 assert.equal(f.events.writes,0);
});
