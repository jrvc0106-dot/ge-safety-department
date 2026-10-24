import test from 'node:test';
import assert from 'node:assert/strict';
import {alignCriticalReportPdfBlocks} from '../src/report-pdf-page-alignment.js';

function layout(kind,blocks){
 const nodes=blocks.map((block,index)=>({...block,index,shift:0,parentNode:null,
  getBoundingClientRect(){return {top:this.top+this.shift,bottom:this.top+this.shift+this.height,height:this.height}},
  hasAttribute(key){return Boolean(this.photo&&key==='data-'+(kind==='jha'?'jha':'equipment')+'-pdf-page')}
 }));
 const inserted=[];
 const parent={insertBefore(spacer,node){
  const amount=Number(spacer.style.cssText.match(/height:([\d.]+)px/)?.[1]||0);
  inserted.push({before:node.index,height:amount});
  for(const later of nodes)if(later.index>=node.index)later.shift+=amount;
 }};
 for(const n of nodes)n.parentNode=parent;
 const report={classList:{contains:name=>name===(kind==='jha'?'ge-reference-jha':'equipment-pdf')},
  querySelectorAll:()=>nodes};
 const container={scrollTop:0,scrollHeight:3000,ownerDocument:{createElement:()=>({
  style:{cssText:''},setAttribute(){},className:''
 })},getBoundingClientRect:()=>({top:0}),querySelector:()=>report};
 return {container,nodes,inserted};
}

test('JHA moves a complete closeout including signatures to the next sheet',()=>{
 const data=layout('jha',[{top:640,height:250},{top:935,height:190}]);
 assert.equal(alignCriticalReportPdfBlocks(data.container,1003),1);
 assert.equal(data.inserted[0].before,1);
 assert.equal(data.inserted[0].height,68);
 assert.equal(data.nodes[1].getBoundingClientRect().top,1003);
});

test('Equipment inspection keeps defects and corrective action on one sheet',()=>{
 const data=layout('equipment',[{top:100,height:650},{top:885,height:260}]);
 assert.equal(alignCriticalReportPdfBlocks(data.container,1003),1);
 assert.equal(data.nodes[1].getBoundingClientRect().top,1003);
 assert.equal(data.inserted[0].height,118);
});

test('JHA short checklist rows cannot be split at the bottom of a page',()=>{
 const data=layout('jha',[{top:970,height:65},{top:1050,height:50}]);
 assert.equal(alignCriticalReportPdfBlocks(data.container,1003),1);
 assert.equal(data.nodes[0].getBoundingClientRect().top,1003);
 assert.equal(data.nodes[1].getBoundingClientRect().top,1083);
});

test('Oversized sections are not pushed repeatedly or replaced with blank pages',()=>{
 const data=layout('equipment',[{top:900,height:1200}]);
 assert.equal(alignCriticalReportPdfBlocks(data.container,1003),0);
 assert.equal(data.inserted.length,0);
});

test('Photo pages retain top-of-sheet alignment when other blocks have moved',()=>{
 const data=layout('equipment',[{top:900,height:180},{top:1140,height:1250,photo:true}]);
 assert.equal(alignCriticalReportPdfBlocks(data.container,1003),2);
 assert.equal(data.nodes[0].getBoundingClientRect().top,1003);
 assert.equal(data.nodes[1].getBoundingClientRect().top,2006);
});

test('Non-JHA and non-equipment reports keep their existing pagination',()=>{
 const container={querySelector:()=>null,getBoundingClientRect:()=>({top:0})};
 assert.equal(alignCriticalReportPdfBlocks(container,1003),0);
});

test('Only high quality paginated PDF exporter receives the new alignment guard',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/pdf-export.js',import.meta.url),'utf8');
 assert.match(source,/alignCriticalReportPdfBlocks\(container,pageHeight\);/);
 assert.match(source,/const totalHeight=Math.max\(1,container.scrollHeight\)/);
});


test('real equipment HTML keeps page-alignment spacers inside tbody as valid rows',async()=>{
 const {JSDOM}=await import('jsdom');
 const dom=new JSDOM('<div id="pdf"><article class="equipment-pdf"><section><h2>Equipment checklist</h2><table class="eq-table"><thead><tr><th>Item</th><th>Status</th><th>Note</th><th>Result</th></tr></thead><tbody><tr id="late"><td>Hydraulic lines</td><td>PASS</td><td>Checked</td><td>PASS</td></tr></tbody></table></section></article></div>');
 const document=dom.window.document,container=document.querySelector('#pdf');
 const section=document.querySelector('section'),row=document.querySelector('#late'),header=document.querySelector('thead tr');
 container.getBoundingClientRect=()=>({top:0,bottom:3200,height:3200});
 section.getBoundingClientRect=()=>({top:0,bottom:1900,height:1900}); // Oversized checklist
 header.getBoundingClientRect=()=>({top:200,bottom:235,height:35});
 row.getBoundingClientRect=()=>({top:977,bottom:1040,height:63});
 try{
  assert.equal(alignCriticalReportPdfBlocks(container,1003),1);
  const spacer=row.previousElementSibling;
  assert.equal(spacer.tagName,'TR');
  assert.equal(spacer.parentElement.tagName,'TBODY');
  assert.equal(spacer.getAttribute('aria-hidden'),'true');
  assert.equal(spacer.firstElementChild.tagName,'TD');
  assert.equal(spacer.firstElementChild.colSpan,4);
  assert.equal(spacer.firstElementChild.style.padding,'0px');
  assert.equal(spacer.style.height,'26px');
  assert.equal(row.cells[0].textContent,'Hydraulic lines');
 }finally{dom.window.close()}
});

test('equipment short corrective-action section still moves intact to next page',async()=>{
 const {JSDOM}=await import('jsdom');
 const dom=new JSDOM('<div id="pdf"><article class="equipment-pdf"><section id="corrective"><h2>03 DEFECTS & CORRECTIVE ACTION</h2><div class="eq-corrective"><div>Defects</div><div>Assigned To</div></div></section></article></div>');
 const document=dom.window.document,container=document.querySelector('#pdf');
 container.getBoundingClientRect=()=>({top:0});
 const section=document.querySelector('#corrective'),corrective=document.querySelector('.eq-corrective');
 section.getBoundingClientRect=()=>({top:880,bottom:1180,height:300});
 corrective.getBoundingClientRect=()=>({top:910,bottom:1170,height:260});
 try{
  assert.equal(alignCriticalReportPdfBlocks(container,1003),1);
  const spacer=section.previousElementSibling;
  assert.equal(spacer.tagName,'DIV');
  assert.equal(spacer.style.height,'123px');
  assert.equal(section.querySelector('.eq-corrective').children.length,2);
 }finally{dom.window.close()}
});
