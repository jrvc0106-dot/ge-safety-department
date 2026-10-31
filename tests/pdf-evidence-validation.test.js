import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {validatePdfEvidenceImages} from '../src/report-pdf-quality.js';

test('ready evidence images are accepted without changing the layout',async()=>{
 const dom=new JSDOM('<div><article class="report"><div class="report-photos"><img src="/site.jpg"></div></article></div>');
 try{
  const img=dom.window.document.querySelector('img');
  Object.defineProperties(img,{naturalWidth:{value:2400},naturalHeight:{value:1600}});
  img.decode=async()=>{};
  assert.equal(await validatePdfEvidenceImages(dom.window.document),1);
  assert.equal(img.getAttribute('src'),'/site.jpg');
 }finally{dom.window.close()}
});

test('a corrupt evidence image fails the export preflight rather than silently disappearing',async()=>{
 const dom=new JSDOM('<article class="report"><div class="report-photos"><img src="/missing.jpg"></div></article>');
 try{
  const img=dom.window.document.querySelector('img');
  img.decode=async()=>{throw Error('decode failed')};
  await assert.rejects(validatePdfEvidenceImages(dom.window.document),/PDF evidence image could not be loaded/);
 }finally{dom.window.close()}
});

test('quick safety orientation remains excluded from general image validation',async()=>{
 const dom=new JSDOM('<article class="report quick-safety-orientation-report"><div class="report-photos"><img src="/missing.jpg"></div></article>');
 try{assert.equal(await validatePdfEvidenceImages(dom.window.document),0)}
 finally{dom.window.close()}
});
