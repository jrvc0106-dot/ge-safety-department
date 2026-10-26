import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {alignGeneralReportPdfEvidence} from '../src/report-pdf-page-alignment.js';
import {pdfPageRasterChoice,renderPaginatedPdf,stabilizeNonQuickPdfColumns} from '../src/pdf-export.js';

const pageSize={inner:{width:8,px:{height:1003}}};
const options={jsPDF:{unit:'in',format:'letter'},margin:[.25,.25,.3,.25],html2canvas:{useCORS:true}};

test('six observation photos and captions move together as a grid, not six broken columns',()=>{
 const markup='<div id="export"><article class="report professional-report"><div class="report-photos">'+
   Array.from({length:6},(_,i)=>'<figure><img src="/proof-'+i+'.jpg"><figcaption>Evidence '+i+'</figcaption></figure>').join('')+
   '</div></article></div>';
 const dom=new JSDOM(markup);
 try{
  const container=dom.window.document.getElementById('export'),grid=container.querySelector('.report-photos');
  container.getBoundingClientRect=()=>({top:0});
  grid.getBoundingClientRect=()=>({top:850,bottom:1350,height:500});
  // Every figure crosses the bottom raster, but a grid is never padded from inside.
  for(const figure of grid.querySelectorAll('figure'))
   figure.getBoundingClientRect=()=>({top:880,bottom:1100,height:220});
  const expected=[...grid.querySelectorAll('figcaption')].map(n=>n.textContent);
  assert.equal(alignGeneralReportPdfEvidence(container,1003),1);
  assert.equal(grid.previousElementSibling.className,'ge-pdf-evidence-alignment-spacer');
  assert.equal(grid.previousElementSibling.style.height,'153px');
  assert.equal(grid.children.length,6);
  assert.equal(grid.querySelectorAll('.ge-pdf-evidence-alignment-spacer').length,0);
  assert.deepEqual([...grid.querySelectorAll('figcaption')].map(n=>n.textContent),expected);
 }finally{dom.window.close()}
});

test('other document photo grids align without any change to their source records',()=>{
 const dom=new JSDOM('<div id="export"><article class="report incident-pdf"><div class="ir-photos"><figure><img><figcaption>Photo 1</figcaption></figure><figure><img><figcaption>Photo 2</figcaption></figure></div></article></div>');
 try{
  const container=dom.window.document.getElementById('export'),grid=container.querySelector('.ir-photos');
  container.getBoundingClientRect=()=>({top:0});
  grid.getBoundingClientRect=()=>({top:950,bottom:1170,height:220});
  const original=grid.outerHTML;
  assert.equal(alignGeneralReportPdfEvidence(container,1003),1);
  assert.equal(grid.outerHTML,original);
  assert.equal(grid.previousElementSibling.style.height,'53px');
 }finally{dom.window.close()}
});

test('Quick Safety Orientation is excluded from photo-grid alignment and selective raster changes',()=>{
 const dom=new JSDOM('<div id="export"><article class="report quick-safety-orientation-report"><div class="report-photos"><figure><img src="photo.jpg"></figure><figure><img src="photo2.jpg"></figure></div></article></div>');
 try{
  const container=dom.window.document.getElementById('export'),html=container.innerHTML;
  container.getBoundingClientRect=()=>({top:0});
  assert.equal(alignGeneralReportPdfEvidence(container,1003),0);
  assert.equal(pdfPageRasterChoice(container,0,1003).format,'JPEG');
  assert.equal(container.innerHTML,html);
 }finally{dom.window.close()}
});

test('non-Quick text-only sheet uses PNG without re-encoding photos or editing the report',async()=>{
 const dom=new JSDOM('<div id="export"><article class="report professional-report"><header><img src="/ge-logo.png"></header><h1>Safety observations</h1><p>Corrective action verified.</p></article></div>');
 try{
  const container=dom.window.document.getElementById('export'),before=container.innerHTML,images=[],encoded=[];
  container.getBoundingClientRect=()=>({top:0});
  Object.defineProperty(container,'scrollHeight',{value:1003});
  class Pdf{
   addImage(...args){images.push(args)}
   output(){return new Blob(['%PDF-1.7\\nSample PDF final report content\\n%%EOF'],{type:'application/pdf'})}
  }
  await renderPaginatedPdf(container,pageSize,options,async()=>{
   return {width:1600,height:2089,toDataURL:(type,quality)=>{
    encoded.push({type,quality});return 'data:image/png;base64,AAA';
   }};
  },Pdf);
  assert.deepEqual(encoded,[{type:'image/png',quality:undefined}]);
  assert.equal(images[0][1],'PNG');
  assert.equal(container.querySelector('article').innerHTML,dom.window.document.querySelector('article').innerHTML);
  assert.equal(container.querySelector('header img').getAttribute('src'),'/ge-logo.png');
  assert.equal(before.includes('Corrective action verified.'),true);
 }finally{dom.window.close()}
});

test('evidence photo page stays high-resolution JPEG while prior text sheet is lossless PNG',async()=>{
 const dom=new JSDOM('<div id="export"><article class="report incident-pdf"><h1>Incident report</h1><div class="ir-photos"><figure><img id="proof" src="/evidence.jpg"></figure></div></article></div>');
 try{
  const container=dom.window.document.getElementById('export'),photo=container.querySelector('#proof'),encoded=[],types=[];
  Object.defineProperty(container,'scrollHeight',{value:2006});
  container.getBoundingClientRect=()=>({top:0});
  photo.getBoundingClientRect=()=>({top:1110,bottom:1350,height:240});
  class Pdf{
   addPage(){}
   addImage(_data,format){types.push(format)}
   output(){return new Blob(['pdf'])}
  }
  await renderPaginatedPdf(container,pageSize,options,async(_container,opts)=>({
   width:1600,height:Math.ceil(opts.height*200/96),
   toDataURL:(type,quality)=>{encoded.push({page:opts.y,type,quality});return 'data:image/jpeg;base64,AAA'}
  }),Pdf);
  assert.deepEqual(types,['PNG','JPEG']);
  assert.deepEqual(encoded.map(e=>[e.type,e.quality]),[['image/png',undefined],['image/jpeg',0.96]]);
 }finally{dom.window.close()}
});

test('iPhone and iPad PDF temporary clone retains two-column photos without modifying Quick Orientation',()=>{
 const dom=new JSDOM('<div id="export"><article class="report incident-pdf"><div class="ir-photos"><figure><img></figure><figure><img></figure></div></article></div>');
 const quick=new JSDOM('<div id="export"><article class="report quick-safety-orientation-report"><div class="quick-report-photos"><figure><img></figure></div></article></div>');
 try{
  const container=dom.window.document.getElementById('export'),quickContainer=quick.window.document.getElementById('export');
  const before=container.querySelector('article').outerHTML;
  assert.equal(stabilizeNonQuickPdfColumns(container),true);
  assert.equal(stabilizeNonQuickPdfColumns(container),true);
  const styles=container.querySelectorAll('style[data-ge-nonquick-pdf-columns]');
  assert.equal(styles.length,1);
  assert.match(styles[0].textContent,/grid-template-columns:repeat\\(2,minmax\\(0,1fr\\)\\)!important/);
  assert.match(styles[0].textContent,/figcaption/);
  assert.equal(container.querySelector('article').outerHTML,before);
  const quickBefore=quickContainer.innerHTML;
  assert.equal(stabilizeNonQuickPdfColumns(quickContainer),false);
  assert.equal(quickContainer.innerHTML,quickBefore);
  assert.equal(quickContainer.querySelector('style'),null);
 }finally{dom.window.close();quick.window.close()}
});
