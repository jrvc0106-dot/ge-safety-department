import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {attachDailyReportBulkStatus} from '../src/jha-bulk-status.js';

function fixture(){
 const doc=new JSDOM('<form id="walk-form"><div class="walk-legend"><span>SAFE</span><span>UNSAFE</span><span>N/A</span><button type="button" data-jha-select-all>Select All</button></div>'+
 Array.from({length:4},(_,i)=>'<section class="walk-item"><div class="walk-status">'+
 ['safe','unsafe','na'].map(value=>'<label><input type="radio" name="status_'+i+'" value="'+value+'">'+value+'</label>').join('')+
 '</div><textarea name="hazard_'+i+'"></textarea><textarea name="correction_'+i+'"></textarea></section>').join('')+
 '<input name="overall_status" value="needs_attention"><button type="submit">Save</button></form>');
 const form=doc.window.document.querySelector('form');
 attachDailyReportBulkStatus(form);
 const radio=(i,value)=>form.querySelector('[name="status_'+i+'"][value="'+value+'"]');
 return {doc,form,radio,button:form.querySelector('[data-jha-select-all]')};
}
test('Select All marks unanswered JHA items SAFE in one click, with change events for autosave',()=>{
 const {doc,form,radio,button}=fixture();
 let changes=0;form.addEventListener('change',event=>{if(event.target.matches('.walk-status input'))changes++});
 button.click();
 for(let i=0;i<4;i++)assert.equal(radio(i,'safe').checked,true);
 assert.equal(changes,4);
 assert.equal(new doc.window.FormData(form).get('status_3'),'safe');
 assert.equal(new doc.window.FormData(form).get('overall_status'),'needs_attention');
 doc.window.close();
});
test('Select All never overwrites an existing UNSAFE or N/A decision or text',()=>{
 const {doc,form,radio,button}=fixture();
 radio(1,'unsafe').click();radio(2,'na').click();
 form.querySelector('[name="hazard_1"]').value='Real fall hazard identified';
 button.click();
 assert.equal(radio(1,'unsafe').checked,true);
 assert.equal(radio(2,'na').checked,true);
 assert.equal(radio(0,'safe').checked,true);
 assert.equal(radio(3,'safe').checked,true);
 button.click();
 assert.equal(radio(1,'unsafe').checked,true);
 assert.equal(form.querySelector('[name="hazard_1"]').value,'Real fall hazard identified');
 doc.window.close();
});
test('any item can be independently switched to Unsafe or N/A after bulk selection',()=>{
 const {doc,form,radio,button}=fixture();
 button.click();
 radio(2,'unsafe').click();radio(3,'na').click();
 assert.equal(new doc.window.FormData(form).get('status_2'),'unsafe');
 assert.equal(new doc.window.FormData(form).get('status_3'),'na');
 assert.equal(new doc.window.FormData(form).get('status_0'),'safe');
 assert.equal(new doc.window.FormData(form).get('status_1'),'safe');
 doc.window.close();
});
test('touching the same checked radio again deselects only that row',()=>{
 const {doc,form,radio,button}=fixture();
 button.click();
 const target=radio(2,'safe');
 let changed=0;form.addEventListener('change',event=>{if(event.target===target)changed++});
 target.dispatchEvent(new doc.window.Event('pointerdown',{bubbles:true}));
 target.click();
 assert.equal(new doc.window.FormData(form).get('status_2'),null);
 assert.equal(radio(0,'safe').checked,true);
 assert.equal(radio(1,'safe').checked,true);
 assert.equal(radio(3,'safe').checked,true);
 assert.equal(changed,1);
 doc.window.close();
});
test('tapping a checked status label deselects that item on iPad-style pointer events',()=>{
 const {doc,form,radio,button}=fixture();
 button.click();
 const label=radio(0,'safe').closest('label');
 label.dispatchEvent(new doc.window.Event('pointerdown',{bubbles:true}));
 label.click();
 assert.equal(radio(0,'safe').checked,false);
 assert.equal(radio(1,'safe').checked,true);
 doc.window.close();
});
test('keyboard Space can clear one selected answer without modifying other rows',()=>{
 const {doc,form,radio,button}=fixture();button.click();
 const target=radio(1,'safe');
 target.dispatchEvent(new doc.window.KeyboardEvent('keydown',{bubbles:true,key:' ',code:'Space'}));
 target.click();
 assert.equal(target.checked,false);
 assert.equal(radio(2,'safe').checked,true);
 doc.window.close();
});
test('Create Daily Report is the only form that mounts the bulk checklist helper',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.equal((source.match(/attachDailyReportBulkStatus\(walkForm\)/g)||[]).length,1);
 const start=source.indexOf('async function safetyWalk()'),end=source.indexOf('async function safetyWalkReport()',start);
 assert.ok(start>=0&&end>start);
 assert.match(source.slice(start,end),/data-jha-select-all/);
 assert.match(source.slice(start,end),/attachDailyReportBulkStatus\(walkForm\)/);
});
