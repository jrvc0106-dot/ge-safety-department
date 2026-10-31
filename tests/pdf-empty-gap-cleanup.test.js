import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {removeRedundantPdfAlignmentSpacers} from '../src/report-pdf-page-alignment.js';

test('duplicate alignment spacers cannot accumulate into an empty extra page',()=>{
 const dom=new JSDOM('<article><div class="ge-pdf-page-alignment-spacer" style="height:65px"></div><div class="ge-pdf-evidence-alignment-spacer" style="height:80px"></div><section id="content">Evidence and signature</section></article>');
 try{
  const root=dom.window.document.querySelector('article');
  assert.equal(removeRedundantPdfAlignmentSpacers(root),1);
  assert.equal(root.querySelectorAll('.ge-pdf-page-alignment-spacer,.ge-pdf-evidence-alignment-spacer').length,1);
  assert.equal(root.querySelector('.ge-pdf-page-alignment-spacer').style.height,'80px');
  assert.equal(root.querySelector('#content').textContent,'Evidence and signature');
 }finally{dom.window.close()}
});

test('blank zero-height export spacers removed but regular form spacing retained',()=>{
 const dom=new JSDOM('<article><div class="ge-pdf-page-alignment-spacer" style="height:0px"></div><div id="form-space" style="height:60px"></div><section>Report</section></article>');
 try{
  const root=dom.window.document.querySelector('article');
  assert.equal(removeRedundantPdfAlignmentSpacers(root),1);
  assert.equal(root.querySelector('#form-space').style.height,'60px');
  assert.equal(root.querySelector('section').textContent,'Report');
 }finally{dom.window.close()}
});
