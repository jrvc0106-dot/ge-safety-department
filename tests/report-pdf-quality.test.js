import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {jsPDF} from 'jspdf';
import {isValidPdfBlob,protectPdfReportLogos} from '../src/report-pdf-quality.js';

test('genuine jsPDF file passes validation for all future jobsite archives',async()=>{
 const pdf=new jsPDF({unit:'in',format:'letter'});
 pdf.text('G&E ONE — future report integrity test',0.5,0.75);
 assert.equal(await isValidPdfBlob(pdf.output('blob')),true);
});

test('zero-byte, truncated and non-PDF data is never accepted as a final report',async()=>{
 const cases=[
  null,
  new Blob([],{type:'application/pdf'}),
  new Blob(['%PDF-1.4']),
  new Blob(['not a PDF file, even with %%EOF']),
  new Blob(['%PDF-1.4\n','valid-looking content'.repeat(3)]),
  {size:100,slice:()=>{throw Error('unreadable')}}
 ];
 for(const blob of cases)assert.equal(await isValidPdfBlob(blob),false);
});

test('logo protection preserves the exact original asset and its natural proportions',()=>{
 const dom=new JSDOM('<article class="report"><header><img src="/ge-logo.png" width="90" height="90" alt="G&E"></header><div class="ewr-watermark"><img src="/ge-logo.png"></div><figure><img src="/photo.jpg"></figure></article>',{url:'https://example.test'});
 const document=dom.window.document,headerLogo=document.querySelector('header img'),photo=document.querySelector('figure img');
 assert.equal(protectPdfReportLogos(document),2);
 assert.equal(headerLogo.getAttribute('src'),'/ge-logo.png');
 assert.equal(headerLogo.getAttribute('width'),'90');
 assert.equal(headerLogo.getAttribute('height'),'90');
 assert.equal(headerLogo.style.getPropertyValue('object-fit'),'contain');
 assert.equal(headerLogo.style.getPropertyPriority('object-fit'),'important');
 assert.equal(headerLogo.style.getPropertyValue('aspect-ratio'),'auto');
 assert.equal(headerLogo.style.getPropertyValue('object-position'),'center');
 assert.equal(photo.style.getPropertyValue('object-fit'),'');
 assert.equal(protectPdfReportLogos(null),0);
 dom.window.close();
});

test('each report type still references the unmodified official G&E logo',()=>{
 for(const path of ['src/main.js','src/safety-tools-model.js','src/quick-safety-orientation.js','src/incident-report-template.js']){
  const content=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(content,/\/ge-logo\.png/,path);
 }
});
