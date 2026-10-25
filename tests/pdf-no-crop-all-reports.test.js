import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {protectPdfReportEvidencePhotos,protectPdfReportLogos} from '../src/report-pdf-quality.js';
import {alignGeneralReportPdfEvidence} from '../src/report-pdf-page-alignment.js';
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const exporter=readFileSync(new URL('../src/pdf-export.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/main.js',import.meta.url),'utf8';

test('report photo frames use contain instead of cover, preserving full evidence',()=>{
 const sections=['.report-photos img','.ewr-evidence img','.report-photo-grid img','.ir-photos img','.inventory-report-table img','.inventory-evidence img'];
 for(const selector of sections){
  const p=css.indexOf(selector+'{');
  assert.ok(p>=0,selector+' missing');
  const rule=css.slice(p,css.indexOf('}',p)+1);
  assert.match(rule,/object-fit:contain/,selector);
  assert.doesNotMatch(rule,/object-fit:cover/,selector);
 }
 // Cropping an avatar in profile screens is intentional and should remain unaffected.
 assert.match(css,/\.profile-avatar-large img\{[^}]*object-fit:cover/);
});
test('the PDF clone protects all evidence images and original GE logo independently',()=>{
 const dom=new JSDOM('<div id="clone"><article class="report professional-report"><header><img src="/ge-logo.png"></header><div class="report-photos"><figure><img id="evidence" src="/site.jpg" style="object-fit:cover"><figcaption>Full evidence</figcaption></figure></div><div class="report-signatures"><img data-signature-strokes="[]" id="signature" src="data:image/png;base64,AA"></div></article></div>');
 try{
  const doc=dom.window.document,clone=doc.querySelector('#clone');
  assert.equal(protectPdfReportLogos(clone,{photos:true}),1);
  const image=doc.querySelector('#evidence');
  assert.equal(image.style.getPropertyValue('object-fit'),'contain');
  assert.equal(image.style.getPropertyPriority('object-fit'),'important');
  assert.equal(image.getAttribute('src'),'/site.jpg');
  assert.equal(doc.querySelector('header img').style.objectFit,'contain');
  assert.equal(doc.querySelector('#signature').style.objectFit,'');
  assert.equal(protectPdfReportEvidencePhotos(null),0);
 }finally{dom.window.close()}
});
test('regular report: move full image and caption together instead of slicing a photo',()=>{
 const dom=new JSDOM('<div id="clone"><article class="report professional-report"><div class="report-photos"><figure id="evidence"><img src="/site.jpg"><figcaption>Evidence of safety observation</figcaption></figure></div></article></div>');
 try{
  const doc=dom.window.document,clone=doc.querySelector('#clone'),image=doc.querySelector('figure');
  clone.getBoundingClientRect=()=>({top:0});
  image.getBoundingClientRect=()=>({top:938,bottom:1118,height:180});
  assert.equal(alignGeneralReportPdfEvidence(clone,1003),1);
  const spacer=image.previousElementSibling;
  assert.equal(spacer.className,'ge-pdf-evidence-alignment-spacer');
  assert.equal(spacer.style.height,'65px');
  assert.equal(spacer.getAttribute('aria-hidden'),'true');
  assert.equal(image.querySelector('figcaption').textContent,'Evidence of safety observation');
 }finally{dom.window.close()}
});
test('long multi-page panels do not insert full-page blank spacer',()=>{
 const dom=new JSDOM('<div><article class="report professional-report"><section class="report-signatures" id="block"></section></article></div>');
 try{
  const clone=dom.window.document.querySelector('div'),block=dom.window.document.querySelector('#block');
  clone.getBoundingClientRect=()=>({top:0});
  block.getBoundingClientRect=()=>({top:950,bottom:2020,height:1070});
  assert.equal(alignGeneralReportPdfEvidence(clone,1003),0);
  assert.equal(block.previousElementSibling,null);
 }finally{dom.window.close()}
});
test('Quick Orientation and JHA keep their specialist layout code',()=>{
 const dom=new JSDOM('<div id="clone"><article class="report quick-safety-orientation-report"><div class="report-photos"><figure><img></figure></div></article></div>');
 try{
  const clone=dom.window.document.querySelector('#clone');
  clone.getBoundingClientRect=()=>({top:0});
  assert.equal(alignGeneralReportPdfEvidence(clone,1003),0);
 }finally{dom.window.close()}
 assert.match(exporter,/alignCriticalReportPdfBlocks\(container,pageHeight\)/);
 assert.match(exporter,/alignGeneralReportPdfEvidence\(container,pageHeight\)/);
 assert.match(app,/protectPdfReportLogos\(container,\{photos:true\}\)/);
});