import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reservePdfDestination,pdfSafeFilename,fileShareSupported,savePdfToDevice} from '../src/pdf-save-location.js';
import {readFileSync} from 'node:fs';
const blob=new Blob(['%PDF-1.7\n'+'DATA '.repeat(15)+'\n%%EOF'],{type:'application/pdf'});

test('filenames are safe and the PDF extension is preserved',()=>{
 assert.equal(pdfSafeFilename('Worker / JHA: 2026?'), 'Worker - JHA- 2026-.pdf');
 assert.equal(pdfSafeFilename('Report.PDF'), 'Report.PDF');
 assert.equal(pdfSafeFilename('../private.pdf'),'private.pdf');
 assert.equal(pdfSafeFilename(''),'GE-ONE-Report.pdf');
});

test('desktop picker requests exact chosen destination before any asynchronous operation',async()=>{
 const calls=[];
 const win={showSaveFilePicker:options=>{
  calls.push(['picker',options.suggestedName]);
  return Promise.resolve({createWritable:async()=>({write:async file=>calls.push(['write',file.size]),close:async()=>calls.push(['close'])})});
 }};
 const dest=reservePdfDestination('JHA #44.pdf',{win});
 assert.deepEqual(calls,[['picker','JHA #44.pdf']]);
 const saved=await savePdfToDevice(blob,'JHA #44.pdf',{destination:dest,win});
 assert.equal(saved.kind,'saved');
 assert.equal(calls[1][0],'write');
 assert.equal(calls[2][0],'close');
});

test('cancelled desktop save picker never downloads or writes the PDF',async()=>{
 const win={showSaveFilePicker:()=>Promise.reject(Object.assign(Error('cancel'),{name:'AbortError'}))};
 const dest=reservePdfDestination('JHA.pdf',{win});
 await assert.rejects(savePdfToDevice(blob,'JHA.pdf',{destination:dest,download:()=>{throw Error('unexpected download')}}),{name:'AbortError'});
});

test('iPad File share sheet offers Save to Files with a proper original PDF file',async()=>{
 const calls=[],nav={canShare:()=>true,share:p=>{calls.push(p);return Promise.resolve()}};
 assert.ok(fileShareSupported(blob,'Employee.pdf',{nav,FileClass:File}));
 const result=await savePdfToDevice(blob,'Employee.pdf',{nav,FileClass:File,download:()=>{throw Error('unexpected download')}});
 assert.equal(result.kind,'shared');
 assert.equal(calls.length,1);
 assert.equal(calls[0].files[0].name,'Employee.pdf');
 assert.equal(calls[0].files[0].type,'application/pdf');
});

test('browsers without native share/picker retain download fallback without claiming a chosen folder',async()=>{
 const calls=[];
 const outcome=await savePdfToDevice(blob,'Report.pdf',{
  nav:{},win:{},doc:{},download:(file,name)=>calls.push([file,name])
 });
 assert.equal(outcome.kind,'download');
 assert.equal(calls.length,1);
 assert.strictEqual(calls[0][0],blob);
 assert.equal(calls[0][1],'Report.pdf');
});

test('damaged or empty PDF bytes are rejected before a file can be shared or saved',async()=>{
 await assert.rejects(savePdfToDevice(new Blob(['bad']), 'bad.pdf',{nav:{},download:()=>{throw Error('called')}}),/incomplete/);
});

test('Save PDF remains in editor but Report Center has exactly two PDF actions',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/class="secondary pdf-save"/);
 assert.match(main,/actions\.append\(add\('view'\),add\('download'\)\)/);
 assert.match(main,/className='report-compact-actions'/);
 assert.doesNotMatch(main,/actionGrid\.append\(add\('view'\),add\('download'\),add\('save'\)\)/);
 assert.match(main,/openLocalReport\(prepared\.localArchive\)/);
 const hooks=readFileSync(new URL('../src/jha-pdf-actions.js',import.meta.url),'utf8');
 assert.match(hooks,/\['view','download','share','save'\]/);
});
