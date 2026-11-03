import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountDesktopNavigation} from '../src/desktop-navigation.js';

function make(role='safety'){
 const dom=new JSDOM('<div id="app"><header></header><main></main></div>');
 const visited=[];
 mountDesktopNavigation({doc:dom.window.document,authenticated:true,role,lang:'en',go:page=>visited.push(page)});
 return {doc:dom.window.document,win:dom.window,visited};
}
test('desktop module search filters navigation only and Enter navigates to first result',()=>{
 const {doc,win,visited}=make();
 const filter=doc.querySelector('.ge-desktop-search');
 assert.ok(filter);
 filter.value='report center';filter.dispatchEvent(new win.Event('input'));
 const visible=[...doc.querySelectorAll('.ge-desktop-link')].filter(b=>!b.hidden);
 assert.equal(visible.length,1);
 assert.match(visible[0].textContent,/Report Center/);
 filter.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 assert.deepEqual(visited,['reportCenter']);
});
test('search does not expose admin-only backup navigation to Safety',()=>{
 const {doc,win}=make('safety');
 const input=doc.querySelector('.ge-desktop-search');
 input.value='backup';input.dispatchEvent(new win.Event('input'));
 assert.equal([...doc.querySelectorAll('.ge-desktop-link')].filter(x=>!x.hidden).length,0);
});
test('desktop navigation never mounts without authentication',()=>{
 const dom=new JSDOM('<div id="app"><header></header><main></main></div>');
 mountDesktopNavigation({doc:dom.window.document,authenticated:false});
 assert.equal(dom.window.document.querySelector('#ge-desktop-sidebar'),null);
});
