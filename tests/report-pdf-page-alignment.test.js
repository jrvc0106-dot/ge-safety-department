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
