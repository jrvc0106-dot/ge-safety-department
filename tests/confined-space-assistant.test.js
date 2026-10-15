import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {inspectConfinedSpace} from '../src/confined-space-assistant.js';
import {TOOL_DEFINITIONS} from '../src/safety-tools-model.js';

test('quick assistant finds missing permit fields, PPE failures and required signatures',()=>{
 const dom=new JSDOM('<form id="permit"><input name="space_id" value="TANK-1"><input name="check_0" value="reviewed"><input name="check_11" value="follow_up"></form>');
 globalThis.FormData=dom.window.FormData;
 const problems=inspectConfinedSpace(dom.window.document.querySelector('form'),TOOL_DEFINITIONS.confined_space);
 assert.ok(problems.some(p=>p.name==='location'));
 assert.ok(problems.some(p=>p.name==='check_11'));
 assert.ok(problems.some(p=>p.name==='jha_entry_supervisor_name'));
 assert.ok(problems.some(p=>p.name==='check_23'));
});
