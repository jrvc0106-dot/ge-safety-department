import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {photoDimensions} from '../src/photo-optimizer.js';
import {protectPdfReportLogos,isValidPdfBlob} from '../src/report-pdf-quality.js';
import {reportDeviceKind} from '../src/report-device-pdf.js';
import {pdfCanvasPageIsBlank} from '../src/pdf-export.js';
const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=load('src/main.js');
const quick=load('src/quick-safety-orientation.js');
const exporter=load('src/pdf-export.js');
test('image preprocessing never changes photo aspect ratio beyond a single-pixel rounding difference',()=>{
 for(const [w,h] of [[4032,3024],[3024,4032],[1920,1080],[1080,1920],[4000,1000],[1000,4000],[500,500],[800,1200]]){
  const resized=photoDimensions(w,h);
  assert.ok(resized.width<=w&&resized.height<=h);
  assert.ok(resized.width*resized.height<=6000000);
  assert.ok(Math.abs(resized.width/resized.height-w/h)<=Math.max(1/resized.height,1/h)+0.002);
 }
});
test('PDF clone protects original GE logo proportions, including report headers',()=>{
 const dom=new JSDOM('<article class="report"><img src="/ge-logo.png"><img src="/other.png"><section><img src="/ge-logo.png"></section></article>');
 const report=dom.window.document.querySelector('article');
 assert.equal(protectPdfReportLogos(report),2);
 const logos=report.querySelectorAll('img[src*="ge-logo.png"]');
 for(const logo of logos){
  assert.equal(logo.style.getPropertyValue('object-fit'),'contain');
  assert.equal(logo.style.getPropertyValue('object-position'),'center');
  assert.equal(logo.style.getPropertyValue('aspect-ratio'),'auto');
 }
 assert.equal(report.querySelector('img[src="/other.png"]').style.objectFit,'');
});
test('all final PDF branches reject truncated files, and quick form keeps a complete source record',async()=>{
 assert.equal(await isValidPdfBlob(new Blob(['%PDF-1.7\nnot a complete PDF document'])),false);
 assert.match(app,/if\(!\(await isValidPdfBlob\(blob\)\)\)/);
 assert.match(app,/await waitForReportImages\(report\)/);
 assert.match(app,/protectPdfReportLogos\(container\)/);
 assert.match(app,/if\(!facePhoto\)return error/);
 assert.match(app,/\.eq\('sticker_number',sticker\)/);
 assert.match(app,/face_photo_path:facePath,status:'final'/);
 assert.match(quick,/quick-report-employee-photo/);
});
test('device output uses separate iPad/mobile layouts but PDF remains Letter sized',()=>{
 assert.equal(reportDeviceKind({userAgent:'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'}),'ipad');
 assert.equal(reportDeviceKind({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'}),'mobile');
 assert.equal(reportDeviceKind({userAgent:'Mozilla/5.0 (Windows NT 10.0)'}),'desktop');
 assert.match(exporter,/renderQuickOrientationPdf/);
 assert.match(exporter,/object-fit:contain!important/);
 assert.match(exporter,/if\(!pagesAdded\)throw/);
});
test('orientation save does not finalize before evidence photo uploads',()=>{
 const upload=app.indexOf("from('quick-orientation-photos').upload(facePath");
 const finalize=app.indexOf("photo_paths:[],face_photo_path:facePath,status:'final'");
 assert.ok(upload>=0&&finalize>upload);
});
test('auto Dropbox uploads only completed reports and keeps records on failures',()=>{
 const source=load('supabase/functions/auto-dropbox-reports/index.ts');
 const schema=load('supabase/automatic-dropbox-final-reports.sql');
 assert.match(source,/status:"completed"/);
 assert.match(source,/create_folder_v2/);
 assert.match(source,/get_metadata/);
 assert.match(schema,/document_status='final'/);
 assert.doesNotMatch(source,/storage\.from\("final-reports"\)\.remove\(/);
});
