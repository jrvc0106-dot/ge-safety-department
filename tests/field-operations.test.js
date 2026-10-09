import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isOverdueDate} from '../src/field-operations.js';
import {installConnectivityStatus} from '../src/connectivity-status.js';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseAst} from 'rollup/parseAst';

test('overdue status uses local calendar dates and never marks closed records overdue',()=>{
 assert.equal(isOverdueDate('2026-10-08','open','2026-10-09'),true);
 assert.equal(isOverdueDate('2026-10-09','open','2026-10-09'),false);
 assert.equal(isOverdueDate('2026-10-08','closed','2026-10-09'),false);
 assert.equal(isOverdueDate(null,'open','2026-10-09'),false);
 assert.equal(isOverdueDate('invalid','open','2026-10-09'),false);
});

test('connectivity banner clearly reports offline draft availability and restored connection in Spanish',()=>{
 const dom=new JSDOM('<body></body>',{url:'https://example.test'});
 let online=true,language='es';
 Object.defineProperty(dom.window.navigator,'onLine',{get:()=>online});
 const cleanup=installConnectivityStatus({window:dom.window,document:dom.window.document,getLanguage:()=>language,onlineDismissMs:5000});
 const banner=dom.window.document.querySelector('#ge-connectivity-status');
 assert.equal(banner.hidden,true);
 online=false;dom.window.dispatchEvent(new dom.window.Event('offline'));
 assert.equal(banner.hidden,false);assert.match(banner.textContent,/Sin conexión/);assert.match(banner.textContent,/borradores/);
 online=true;dom.window.dispatchEvent(new dom.window.Event('online'));
 assert.match(banner.textContent,/Conexión restablecida/);
 cleanup();dom.window.close();
});

test('submission guard stops invalid reports before invoking their save handler',async()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const ast=parseAst(source),node=ast.body.find(x=>x.type==='FunctionDeclaration'&&x.id.name==='installFormSubmissionGuards');
 assert.ok(node,'submission guard exists in application source');
 const dom=new JSDOM('<main><form><input name="required" required><button type="submit">Save</button></form></main>');
 const form=dom.window.document.querySelector('form');let saves=0;
 form.onsubmit=async()=>{saves++};
 const context=vm.createContext({document:dom.window.document,error:()=>{}});
 vm.runInContext(source.slice(node.start,node.end),context);
 context.installFormSubmissionGuards();
 await form.onsubmit({preventDefault(){}});
 assert.equal(saves,0);
 form.elements.required.value='complete';
 await form.onsubmit({preventDefault(){}});
 assert.equal(saves,1);
 dom.window.close();
});

test('observation creation requires evidence and an assigned action due date',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const start=source.indexOf('function newObservation()'),end=source.indexOf('function upload(',start);
 assert.ok(start>=0&&end>start);
 const form=source.slice(start,end);
 assert.match(form,/name="area" maxlength="120" required/);
 assert.match(form,/name="description" maxlength="2000" required/);
 assert.match(form,/name="due_date" type="date"/);
 assert.match(form,/if\(!draftPhotos\.length\)/);
 assert.match(form,/f\.get\('assigned_to'\)&&!f\.get\('due_date'\)/);
 assert.match(form,/due_date:f\.get\('due_date'\)\|\|null/);
});
