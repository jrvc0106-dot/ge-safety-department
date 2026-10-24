import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachMobileFieldGuide, jhaChecklistProgress} from '../src/mobile-field-workflow.js';

test('JHA progress follows radio answers, without changing any form values', () => {
  const dom = new JSDOM('<form id="walk-form"><div class="walk-item"><h3>1</h3><div class="walk-status"><label><input type="radio" name="status_0" value="safe"></label><label><input type="radio" name="status_0" value="unsafe"></label></div></div><div class="walk-item"><h3>2</h3><div class="walk-status"><label><input type="radio" name="status_1" value="safe"></label><label><input type="radio" name="status_1" value="na"></label></div></div><section class="walk-final"><h2>Signatures</h2><button type="submit">Complete</button></section></form>');
  const {document:doc}=dom.window,form=doc.querySelector('form');
  assert.deepEqual(jhaChecklistProgress(form),{total:2,answered:0,remaining:2});
  assert.equal(attachMobileFieldGuide({doc}),true);
  assert.equal(attachMobileFieldGuide({doc}),false);
  assert.equal(doc.querySelectorAll('.ge-mobile-field-guide').length,1);
  assert.equal(doc.querySelector('progress').value,0);
  assert.equal(form.querySelectorAll('input[type=radio]:checked').length,0);
  const unsafe=form.querySelector('input[value=unsafe]');unsafe.checked=true;unsafe.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(doc.querySelector('progress').value,1);
  assert.equal(form.querySelector('input[name=status_0]:checked').value,'unsafe');
  assert.equal(doc.querySelectorAll('button[type=submit]').length,1);
  assert.equal(doc.querySelectorAll('.ge-mobile-guide-button[type=button]').length,2);
  dom.window.close();
});

test('observation guide never removes required controls, evidence, or submit buttons', () => {
  const dom = new JSDOM('<form id="observation"><label>Description<textarea name="description" required></textarea></label><label>Priority<select name="priority"><option>high</option></select></label><label>Photos<input name="photo" type="file" multiple></label><button type="submit">Save</button></form>');
  const doc=dom.window.document,form=doc.querySelector('form');
  const controls=[...form.elements].map(x=>x.name).filter(Boolean);
  attachMobileFieldGuide({doc});
  assert.deepEqual([...form.elements].map(x=>x.name).filter(Boolean),controls);
  assert.equal(form.querySelector('[name=photo]').multiple,true);
  assert.equal(form.querySelector('textarea').required,true);
  assert.equal(form.querySelectorAll('.ge-mobile-guide-button').length,3);
  dom.window.close();
});

test('orientation field guide leaves face camera input, sticker, photos, and signatures available', () => {
  const dom=new JSDOM('<form id="quick-orientation-form"><div class="quick-employee-grid"><input name="sticker_number"></div><div class="quick-face-id"><input id="quick-face-camera" type="file" capture="user"></div><div class="quick-hazard-grid"><input type="checkbox" name="hazards"></div><div class="quick-ack-card"><input type="checkbox" name="acknowledged"><input name="jha_employee_signature"></div><button type="submit">Save & Create Final Report</button></form>');
  const doc=dom.window.document,form=doc.querySelector('form');
  assert.equal(attachMobileFieldGuide({doc,tr:(a,b)=>b}),true);
  assert.equal(form.querySelector('input[name=sticker_number]').getAttribute('name'),'sticker_number');
  assert.equal(form.querySelector('#quick-face-camera').getAttribute('capture'),'user');
  assert.equal(form.querySelector('input[name=jha_employee_signature]').name,'jha_employee_signature');
  assert.equal(form.querySelectorAll('.ge-mobile-guide-button').length,4);
  assert.equal(form.querySelectorAll('button[type=submit]').length,1);
  assert.match(doc.querySelector('.ge-mobile-field-guide').textContent,/Herramientas de campo/);
  dom.window.close();
});
