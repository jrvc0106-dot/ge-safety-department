import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {APPEARANCE_THEMES,APPEARANCE_THEME_IDS,APPEARANCE_KEY,validAppearance,contrastRatio,installAppearanceTheme,mountAppearanceSettings} from '../src/appearance-themes.js';

function fixture(){
 const dom=new JSDOM('<!doctype html><html><head><meta name="theme-color" content="#0b2d4d"></head><body><main><section class="card narrow"><label>Language<select id="settings-language"><option>English</option></select></label><form id="password-form"><button type="submit">Save password</button></form></section></main></body></html>',{url:'https://ge-one.example/'});
 const {document:doc}=dom.window;
 const tr=(en,es)=>en;
 return {dom,doc,tr};
}

test('four stable themes and unknown stored values resolve to Original',()=>{
 assert.deepEqual(APPEARANCE_THEME_IDS,['original','dark','gray','mix']);
 assert.equal(validAppearance('dark'),'dark');
 assert.equal(validAppearance('bogus'),'original');
 assert.equal(validAppearance('__proto__'),'original');
 assert.equal(validAppearance(null),'original');
});

test('every theme provides WCAG AA contrast for primary and secondary text',()=>{
 for(const [id,palette] of Object.entries(APPEARANCE_THEMES)){
  for(const surface of [palette.bg,palette.surface,palette.subtle]){
   assert.ok(contrastRatio(palette.text,surface)>=4.5,id+' primary text lacks WCAG AA contrast on '+surface);
   assert.ok(contrastRatio(palette.muted,surface)>=4.5,id+' secondary text lacks WCAG AA contrast on '+surface);
  }
  assert.ok(contrastRatio(palette.accentText,palette.accent)>=4.5,id+' call to action text');
 }
 // Color Mix operational tiles and incidents always have readable white labels.
 for(const background of ['#174f87','#205ba5','#875307','#176942','#0a6874','#5943a5','#bd2534','#a51b2b']){
  assert.ok(contrastRatio('#ffffff',background)>=4.5,'Module text on '+background);
 }
});

test('theme selection applies instantly and persists locally without altering forms',()=>{
 const t=fixture(),{dom,doc,tr}=t;
 const manager=installAppearanceTheme({win:dom.window,doc});
 assert.equal(doc.documentElement.dataset.geTheme,'original');
 assert.equal(mountAppearanceSettings({doc,appearance:manager,tr}),true);
 assert.equal(mountAppearanceSettings({doc,appearance:manager,tr}),false);
 assert.equal(doc.querySelectorAll('.ge-theme-choice').length,4);
 assert.equal(doc.querySelector('#password-form button').type,'submit');
 assert.equal(doc.querySelectorAll('#settings-language').length,1);
 assert.equal(doc.querySelector('[data-theme="original"]').getAttribute('aria-pressed'),'true');
 doc.querySelector('[data-theme="dark"]').click();
 assert.equal(manager.getTheme(),'dark');
 assert.equal(doc.documentElement.dataset.geTheme,'dark');
 assert.equal(doc.querySelector('meta[name="theme-color"]').content,APPEARANCE_THEMES.dark.bg);
 assert.equal(doc.documentElement.style.colorScheme,'dark');
 assert.equal(dom.window.localStorage.getItem(APPEARANCE_KEY),'dark');
 assert.equal(doc.querySelector('[data-theme="dark"]').getAttribute('aria-pressed'),'true');
 assert.equal(doc.querySelector('[data-theme="original"]').getAttribute('aria-pressed'),'false');
 dom.window.close();
});

test('gray and Color Mix survive reopening Settings and do not alter the selected project',()=>{
 const t=fixture(),{dom,doc,tr}=t;
 dom.window.localStorage.setItem('ge_selected_project_v1:worker','miramar-cove');
 dom.window.localStorage.setItem(APPEARANCE_KEY,'gray');
 const manager=installAppearanceTheme({win:dom.window,doc});
 assert.equal(manager.getTheme(),'gray');
 mountAppearanceSettings({doc,appearance:manager,tr});
 doc.querySelector('[data-theme="mix"]').click();
 assert.equal(manager.getTheme(),'mix');
 assert.equal(dom.window.localStorage.getItem('ge_selected_project_v1:worker'),'miramar-cove');
 doc.querySelector('#ge-theme-settings').remove();
 assert.equal(mountAppearanceSettings({doc,appearance:manager,tr}),true);
 assert.equal(doc.querySelector('[data-theme="mix"]').getAttribute('aria-pressed'),'true');
 assert.match(doc.querySelector('.ge-theme-preview-heading').textContent,/Sample design/);
 dom.window.close();
});

test('mobile Settings and invitation pages remain accessible',()=>{
 const t=fixture(),{dom,doc,tr}=t;
 const manager=installAppearanceTheme({win:dom.window,doc});
 assert.equal(mountAppearanceSettings({doc,appearance:manager,tr,invitation:true}),false);
 assert.equal(doc.querySelector('#ge-theme-settings'),null);
 dom.window.close();
});

test('localStorage denial retains the selected theme in the current session',()=>{
 const t=fixture(),{dom,doc}=t;
 const storage={getItem(){throw Error('Storage denied')},setItem(){throw Error('Storage denied')}};
 const manager=installAppearanceTheme({win:dom.window,doc,storage});
 assert.equal(manager.setTheme('dark'),'dark');
 assert.equal(doc.documentElement.dataset.geTheme,'dark');
 assert.equal(manager.setTheme('invalid'),'original');
 dom.window.close();
});

test('screen-only overrides explicitly exclude paper reports and the original design',()=>{
 const css=readFileSync(new URL('../src/appearance-themes.css',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(css,/@media screen/);
 assert.match(css,/@media print/);
 assert.match(css,/article\.report/);
 assert.match(css,/print-report/);
 assert.match(css,/registered-safety-orientation-report/);
 assert.match(css,/data-ge-theme="original"/);
 assert.match(main,/mountAppearanceSettings\(\{doc:document,appearance:appearanceTheme/);
 assert.match(main,/installAppearanceTheme\(\{win:window,doc:document\}\)/);
});


test('refined Dark uses readable graphite palette with 4.5:1+ text contrast',()=>{
 const dark=APPEARANCE_THEMES.dark;
 for(const surface of [dark.bg,dark.surface,dark.subtle,dark.bar]){
  assert.ok(contrastRatio(dark.text,surface)>=4.5,'Dark main text unreadable on '+surface);
  assert.ok(contrastRatio(dark.muted,surface)>=4.5,'Dark secondary text unreadable on '+surface);
 }
 const css=readFileSync(new URL('../src/appearance-themes.css',import.meta.url),'utf8');
 const refinement=css.split('/* ===== GE ONE REFINED PALETTE')[1];
 assert.ok(refinement,'Dark/Color Mix polish stylesheet must exist');
 for(const color of ['#0e151c','#1c2833','#273746','#f4f8fc','#c0d0dd']){
  assert.ok(refinement.includes(color),'Missing Dark shade '+color);
 }
 for(const key of ['.quick-employee-field','.section-heading p','.home-open-description b','.ge-theme-choice small','input:not([type="checkbox"])']){
  assert.ok(refinement.includes(key),'Dark readability scope missing: '+key);
 }
});

test('Color Mix assigns 24 unique WCAG-accessible module colors, including safety tools',()=>{
 const css=readFileSync(new URL('../src/appearance-themes.css',import.meta.url),'utf8');
 const refinement=css.split('/* ===== GE ONE REFINED PALETTE')[1];
 assert.ok(refinement,'Appearance refinement missing');
 const matches=[...refinement.matchAll(/html\[data-ge-theme="mix"\] #app \.home-shell \.home-actions > \.home-action(#[a-z0-9-]+|\[data-safety-tool="[a-z_]+"\])\{--ge-mix-tile:(#[0-9A-Fa-f]{6});\}/g)];
 const colors=new Map(matches.map(([,selector,color])=>[selector,color.toLowerCase()]));
 assert.equal(colors.size,24,'No Home card should share a generic or accidental color');
 assert.equal(new Set(colors.values()).size,24,'Each module must have a distinct assigned HEX color');
 for(const [selector,color] of colors){
  assert.ok(contrastRatio('#ffffff',color)>=4.5,'White module label loses contrast on '+selector+' '+color);
 }
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 for(const selector of colors.keys()){
  if(selector.startsWith('#'))assert.ok(main.includes('id="'+selector.slice(1)+'"')||
    ['#home-manage-projects','#home-team-access-activity','#home-help-center'].includes(selector),
    'Missing Home module '+selector);
 }
 assert.equal(colors.get('#home-incident'),'#b52236','Incidents must remain visibly red');
 for(const kind of ['safety_notes','toolbox','training','safety_net','emergency','director','confined_space','medical_followup','hazard']){
  assert.ok(colors.has('[data-safety-tool="'+kind+'"]'),'Missing Safety tool '+kind);
 }
 // This polish only introduces Dark and Mix overrides; Original and Gray are not restyled.
 assert.doesNotMatch(refinement,/html\[data-ge-theme="original"\][^{]*\{/);
 assert.doesNotMatch(refinement,/html\[data-ge-theme="gray"\][^{]*\{/);
 // Layout and functionality remain unchanged: only visual properties may be added.
 assert.doesNotMatch(refinement,/(?:grid-template-columns|grid-template-rows|padding|margin|font-size|position|width|height)\s*:/);
});
