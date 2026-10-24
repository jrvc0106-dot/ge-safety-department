import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {normalizeDisplayPreference, resolveDisplayMode, installMobileExperience, decorateMobileFrame, DISPLAY_MODE_STORAGE_KEY} from '../src/mobile-experience.js';

test('automatic mode responds to phone width while tablets keep the existing layout', () => {
  assert.equal(resolveDisplayMode('auto', 375), 'mobile');
  assert.equal(resolveDisplayMode('auto', 599), 'mobile');
  assert.equal(resolveDisplayMode('auto', 600), 'desktop');
  assert.equal(resolveDisplayMode('auto', 1024), 'desktop');
  assert.equal(normalizeDisplayPreference('unknown'), 'auto');
});
test('manual override persists on each device, including across orientation changes', () => {
  const dom = new JSDOM('<div id="app"></div>', {url:'https://ge.example/'});
  const {window: win} = dom;
  Object.defineProperty(win, 'innerWidth', {value:390, configurable:true});
  const mobile = installMobileExperience({win,doc:win.document});
  assert.equal(mobile.getMode(),'mobile');
  assert.equal(mobile.setPreference('desktop'),'desktop');
  assert.equal(win.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY),'desktop');
  Object.defineProperty(win,'innerWidth',{value:850, configurable:true});
  win.dispatchEvent(new win.Event('resize'));
  assert.equal(mobile.getMode(),'desktop');
  assert.equal(mobile.setPreference('auto'),'desktop');
  Object.defineProperty(win,'innerWidth',{value:375, configurable:true});
  win.dispatchEvent(new win.Event('orientationchange'));
  assert.equal(mobile.getMode(),'mobile');
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
  select.value='mobile';
  select.dispatchEvent(new win.Event('change',{bubbles:true}));
  assert.equal(mobile.getPreference(),'mobile');
  assert.equal(doc.querySelector('.mobile-bottom').getAttribute('role'),'navigation');
  mobile.dispose();
});
