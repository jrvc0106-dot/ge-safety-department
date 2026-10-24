import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {reportDeviceKind,deviceKindFromWindow,applyAdaptiveReportPdfLayout} from '../src/report-device-pdf.js';

test('recognizes a modern iPad with desktop-style Safari user agent',()=>{
 assert.equal(reportDeviceKind({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',maxTouchPoints:5,screenWidth:1024,screenHeight:1366}),'ipad');
 assert.equal(reportDeviceKind({userAgent:'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',maxTouchPoints:5}),'ipad');
});
test('recognizes iPhone and Android mobile even after landscape rotation',()=>{
 assert.equal(reportDeviceKind({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',screenWidth:844,screenHeight:390}),'mobile');
 assert.equal(reportDeviceKind({userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit Mobile',mobileHint:true}),'mobile');
 assert.equal(reportDeviceKind({screenWidth:844,screenHeight:390,coarse:true}),'mobile');
});
test('does not falsely identify a desktop Mac as an iPad',()=>{
 assert.equal(reportDeviceKind({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',maxTouchPoints:0}),'desktop');
 assert.equal(reportDeviceKind({userAgent:'Mozilla/5.0 (Linux; Android 14; Tablet)',screenWidth:800,screenHeight:1280}),'tablet');
});
test('detects a window device without collecting or persisting personal data',()=>{
 const profile=deviceKindFromWindow({navigator:{userAgent:'iPad',maxTouchPoints:5},screen:{width:820,height:1180}});
 assert.equal(profile,'ipad');
});
function makeReport(kind,photos){
 const sectionClass=kind==='jha'?'ewr-section ewr-photo-page':'eq-photo-page';
 const attr=kind==='jha'?'data-jha-pdf-page':'data-equipment-pdf-page';
 const card=(i)=>kind==='jha'
  ?'<figure class="ewr-photo-card"><img src="photo-'+i+'.jpg"><figcaption>Photo '+i+'</figcaption><p>Full finding and corrective action '+i+'</p></figure>'
  :'<figure><div class="eq-photo-frame"><img src="photo-'+i+'.jpg"></div><figcaption>Photo '+i+'</figcaption></figure>';
 const markup='<div id="pdf"><article class="report '+(kind==='jha'?'ge-reference-jha':'equipment-pdf')+'"><section class="'+sectionClass+'" '+attr+'><div class="'+(kind==='jha'?'ewr-photo-register-grid':'eq-photos')+'">'+Array.from({length:photos},(_,i)=>card(i+1)).join('')+'</div></section></article></div>';
 const dom=new JSDOM(markup);return {dom,container:dom.window.document.querySelector('#pdf')};
}
for(const kind of ['jha','equipment'])for(const count of [1,4,5,6]){
 test(kind+' '+count+' photos remain complete in one fixed Letter PDF sheet from phone or iPad',()=>{
  for(const mode of ['mobile','ipad']){
   const {dom,container}=makeReport(kind,count);
   try{
    const figures=container.querySelectorAll('figure'),notes=[...container.querySelectorAll('figcaption,p')].map(e=>e.textContent);
    const result=applyAdaptiveReportPdfLayout(container,{inner:{width:8,px:{height:1003}}},{sourceDevice:mode});
    assert.deepEqual({applied:result.applied,photoPages:result.photoPages,sourceDevice:result.sourceDevice},{applied:true,photoPages:1,sourceDevice:mode});
    assert.equal(container.querySelectorAll('figure').length,count);
    assert.deepEqual([...container.querySelectorAll('figcaption,p')].map(e=>e.textContent),notes);
    assert.equal(container.querySelector('article').style.getPropertyValue('--ge-pdf-width'),'768px');
    const page=container.querySelector('section'),height=page.style.getPropertyValue('--ge-pdf-photo-height');
    assert.ok(parseInt(height)>=88&&parseInt(height)<=255);
    const css=container.querySelector('style[data-ge-pdf-device-layout]').textContent;
    assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
    assert.match(css,/object-fit:contain!important/);
    assert.match(css,/overflow-wrap:anywhere!important/);
    assert.equal(container.querySelector('article').dataset.geSourceDevice,mode);
   }finally{dom.window.close()}
  }
 });
}
test('preserves all other report PDFs without changing their styles',()=>{
 const dom=new JSDOM('<div id="pdf"><article class="report incident-pdf"><figure><img src="a.jpg"></figure></article></div>');
 try{
  const container=dom.window.document.querySelector('#pdf');
  assert.deepEqual(applyAdaptiveReportPdfLayout(container,{inner:{width:8}}),{applied:false,photoPages:0});
  assert.equal(container.querySelector('style[data-ge-pdf-device-layout]'),null);
 }finally{dom.window.close()}
});
test('rejects a malformed photo page containing more than six images',()=>{
 const {dom,container}=makeReport('jha',7);
 try{assert.throws(()=>applyAdaptiveReportPdfLayout(container,{inner:{width:8}}),/six photos/)}
 finally{dom.window.close()}
});
test('mobile UI marker does not change saved report data or PDF exports',async()=>{
 const {readFileSync}=await import('node:fs');
 const mobile=readFileSync(new URL('../src/mobile-experience.js',import.meta.url),'utf8');
 const exportCode=readFileSync(new URL('../src/pdf-export.js',import.meta.url),'utf8');
 assert.match(mobile,/dataset\.geReportDevice = deviceKindFromWindow\(win\)/);
 assert.match(exportCode,/applyAdaptiveReportPdfLayout\(container,pageSize/);
});
