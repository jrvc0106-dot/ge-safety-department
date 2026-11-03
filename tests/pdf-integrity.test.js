import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidPdfBlob,validatePdfEvidenceImages,protectPdfReportLogos} from '../src/report-pdf-quality.js';
import {pdfSafeFilename,savePdfToDevice} from '../src/pdf-save-location.js';

const validPdf=new Blob(['%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n'],{type:'application/pdf'});
test('PDF integrity accepts complete PDF and rejects partial files',async()=>{
 assert.equal(await isValidPdfBlob(validPdf),true);
 assert.equal(await isValidPdfBlob(new Blob(['%PDF-1.7\n'+('x'.repeat(40))])),false);
 assert.equal(await isValidPdfBlob(new Blob(['invalid data'.repeat(8)])),false);
});
test('evidence validation rejects unloaded photographs instead of exporting',async()=>{
 const img={getAttribute:()=> 'data:image/png;base64,xxx',naturalWidth:0,naturalHeight:0,decode:async()=>{throw Error('decode error')}};
 const container={querySelectorAll:()=>[img]};
 await assert.rejects(validatePdfEvidenceImages(container),/PDF evidence image/);
});
test('evidence validation accepts decoded photographs',async()=>{
 const img={getAttribute:()=> 'data:image/png;base64,xxx',naturalWidth:1200,naturalHeight:900,decode:async()=>{}};
 assert.equal(await validatePdfEvidenceImages({querySelectorAll:()=>[img]}),1);
});
test('report logo proportions are protected without changing its source',()=>{
 const values={};const logo={style:{setProperty:(k,v)=>{values[k]=v}},getAttribute:()=>'/ge-logo.png'};
 assert.equal(protectPdfReportLogos({querySelectorAll:()=>[logo]}),1);
 assert.equal(values['object-fit'],'contain');assert.equal(values['aspect-ratio'],'auto');
});
test('PDF filename removes filesystem-unsafe characters',()=>{
 assert.equal(pdfSafeFilename('Incident:/Test?.pdf'),'Incident--Test-.pdf');
});
test('saving a PDF uses the same source blob, with no image recompression',async()=>{
 let blobSeen=null,nameSeen=null;
 const r=await savePdfToDevice(validPdf,'Safety.pdf',{destination:{kind:'system'},nav:{},download:(blob,name)=>{blobSeen=blob;nameSeen=name}});
 assert.equal(r.kind,'download');assert.strictEqual(blobSeen,validPdf);assert.equal(nameSeen,'Safety.pdf');
});
