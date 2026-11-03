import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {normalizeDisplayPreference, resolveDisplayMode, installMobileExperience, decorateMobileFrame, DISPLAY_MODE_STORAGE_KEY} from '../src/mobile-experience.js';

test('current automatic mode keeps the tablet presentation without changing data or PDFs',()=>{
 for(const width of [375,599,600,844,1024]){
  assert.equal(resolveDisplayMode('auto',width,width<600),'desktop');
 }
 assert.equal(normalizeDisplayPreference('mobile'),'auto');
 assert.equal(normalizeDisplayPreference('desktop'),'auto');
 assert.equal(normalizeDisplayPreference('unknown'),'auto');
});
test('current adaptive tablet-only preference remains stable across resize and orientation',()=>{
 const dom=new JSDOM('<div id="app"></div>',{url:'https://ge.example/'});
 const {window:win}=dom;
 Object.defineProperty(win,'innerWidth',{value:390,configurable:true});
 const mobile=installMobileExperience({win,doc:win.document});
 assert.equal(mobile.getMode(),'desktop');
 assert.equal(mobile.setPreference('desktop'),'desktop');
 assert.equal(win.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY),'auto');
 Object.defineProperty(win,'innerWidth',{value:850,configurable:true});
 win.dispatchEvent(new win.Event('resize'));
 assert.equal(mobile.getMode(),'desktop');
 Object.defineProperty(win,'innerWidth',{value:375,configurable:true});
 win.dispatchEvent(new win.Event('orientationchange'));
 assert.equal(mobile.getMode(),'desktop');
 mobile.dispose();
 assert.equal(win.document.documentElement.hasAttribute('data-ge-display-mode'),false);
});
test('settings and project note are added once without replacing existing controls', () => {
  const dom = new JSDOM('<div id="app"><label>Language<select id="settings-language"><option>English</option></select></label><select id="home-project"><option>Miramar Cove</option></select><div class="mobile-bottom"><button id="bottom-home">Home</button></div></div>',{url:'https://ge.example/'});
  const {window:win}=dom,doc=win.document;
  const mobile=installMobileExperience({win,doc});
  decorateMobileFrame({doc,mobile});
  decorateMobileFrame({doc,mobile});
  assert.equal(doc.querySelectorAll('#ge-display-mode').length,1);
  assert.equal(doc.querySelectorAll('#home-project').length,1);
  assert.equal(doc.querySelectorAll('#ge-mobile-project-note').length,1);
  assert.equal(doc.querySelectorAll('#bottom-home').length,1);
  const select=doc.getElementById('ge-display-mode');
  select.value='auto';
  select.dispatchEvent(new win.Event('change',{bubbles:true}));
  assert.equal(mobile.getPreference(),'auto');
  assert.equal(select.disabled,true);
  assert.equal(doc.querySelector('.mobile-bottom').getAttribute('role'),'navigation');
  mobile.dispose();
});
