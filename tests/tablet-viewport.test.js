import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installTabletViewport} from '../src/tablet-viewport.js';
test('tablet keyboard hides fixed navigation; rotation and pinch zoom do not',()=>{
 const dom=new JSDOM('<textarea></textarea>'),win=dom.window,doc=win.document;
 const viewport=new win.EventTarget();Object.assign(viewport,{height:1024,scale:1});
 win.visualViewport=viewport;win.innerHeight=1024;win.matchMedia=()=>({matches:true});
 const frames=[];win.requestAnimationFrame=fn=>{frames.push(fn);return frames.length};win.cancelAnimationFrame=()=>{};
 const dispose=installTabletViewport(win,doc);
 const hasKeyboard=()=>doc.documentElement.hasAttribute('data-ge-keyboard');
 doc.querySelector('textarea').focus();viewport.height=600;viewport.dispatchEvent(new win.Event('resize'));frames.pop()();
 assert.equal(hasKeyboard(),true);
 viewport.scale=2;viewport.dispatchEvent(new win.Event('resize'));frames.pop()();assert.equal(hasKeyboard(),false);
 viewport.scale=1;win.innerHeight=600;viewport.dispatchEvent(new win.Event('resize'));frames.pop()();assert.equal(hasKeyboard(),false);
 dispose();assert.equal(hasKeyboard(),false);dom.window.close();
});
