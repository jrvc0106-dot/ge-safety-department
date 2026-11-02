import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/device-presentation.js',import.meta.url),'utf8');
async function check({ua,width,fine,coarse,touches=0},expected){
 const watchers=[];
 const matches=q=>{
  if(q.includes('max-width'))return width<=700;
  if(q.includes('min-width'))return width>=1100;
  if(q.includes('pointer: fine'))return !!fine;
  if(q.includes('pointer: coarse'))return !!coarse;
  return false;
 };
 globalThis.document={documentElement:{dataset:{}}};
 Object.defineProperty(globalThis,'navigator',{value:{userAgent:ua,maxTouchPoints:touches},configurable:true});
 globalThis.window={matchMedia:q=>({matches:matches(q),addEventListener:(e,fn)=>watchers.push(fn)}),addEventListener(){},requestAnimationFrame:fn=>fn()};
 const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')+'#'+Math.random());
 assert.equal(module.getDevicePresentation(),expected);
 assert.equal(document.documentElement.dataset.geDevice,expected);
}
test('Windows large-screen desktop',()=>check({ua:'Windows NT 10.0',width:1440,fine:true,coarse:false},'desktop'));
test('Windows touchscreen laptop',()=>check({ua:'Windows NT 10.0',width:1440,fine:true,coarse:true},'desktop'));
test('Narrow desktop window does not become a phone',()=>check({ua:'Windows NT 10.0',width:650,fine:true,coarse:false},'tablet'));
test('iPadOS with desktop user-agent stays tablet',()=>check({ua:'Macintosh',width:1366,fine:false,coarse:true,touches:5},'tablet'));
test('Android tablet stays tablet',()=>check({ua:'Mozilla/5.0 Android 14; Tablet',width:1280,fine:false,coarse:true},'tablet'));
test('iPhone stays mobile',()=>check({ua:'iPhone',width:390,fine:false,coarse:true},'mobile'));
test('Android phone stays mobile',()=>check({ua:'Android Mobile',width:412,fine:false,coarse:true},'mobile'));
