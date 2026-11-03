import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountDesktopCommand} from '../src/desktop-command.js';
function setup(){
 const dom=new JSDOM('<div id="app"><header></header><main></main></div>',{url:'https://example.test'});
 const calls=[];
 const args={doc:dom.window.document,authenticated:true,lang:'en',projectId:'one',projects:[{id:'one',name:'Rivage'},{id:'two',name:'Domus'}],observations:[{project_id:'one',status:'open',description:'Open item'},{project_id:'one',status:'closed'},{project_id:'two',status:'open'}],go:page=>calls.push(page)};
 return {dom,calls,args};
}
test('command panel uses only current jobsite observations and safe text',()=>{
 const {dom,args}=setup();mountDesktopCommand(args);
 const panel=dom.window.document.querySelector('#ge-desktop-command');
 assert.ok(panel);assert.match(panel.textContent,/Rivage/);
 assert.equal(panel.querySelector('.ge-command-count').textContent,'1');
 assert.doesNotMatch(panel.textContent,/Domus/);
});
test('desktop command quick action preserves app routing',()=>{
 const {dom,args,calls}=setup();mountDesktopCommand(args);
 const buttons=[...dom.window.document.querySelectorAll('.ge-command-action')];
 buttons[2].click();assert.deepEqual(calls,['reportCenter']);
});
test('panel collapse is restored per browser and prevents duplicates',()=>{
 const {dom,args}=setup();mountDesktopCommand(args);
 dom.window.document.querySelector('#ge-command-toggle').click();
 assert.equal(dom.window.document.documentElement.dataset.geCommandCollapsed,'true');
 mountDesktopCommand(args);
 assert.equal(dom.window.document.querySelectorAll('#ge-desktop-command').length,1);
 assert.equal(dom.window.document.documentElement.dataset.geCommandCollapsed,'true');
});
test('no command panel without login',()=>{
 const {dom,args}=setup();mountDesktopCommand({...args,authenticated:false});
 assert.equal(dom.window.document.querySelector('#ge-desktop-command'),null);
});
