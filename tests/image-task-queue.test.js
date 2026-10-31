import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTaskQueue} from '../src/image-cache.js';

test('photo queue respects concurrency and preserves results',async()=>{
 const run=createTaskQueue(2),releases=[];
 let active=0,peak=0;
 const jobs=Array.from({length:100},(_,i)=>run(async()=>{
  active++;peak=Math.max(peak,active);
  await new Promise(resolve=>releases.push(resolve));
  active--;return i;
 }));
 // Flush pending microtasks and release each task in order.
 const results=[];
 for(let i=0;i<100;i++){
  while(releases.length===0)await new Promise(resolve=>setImmediate(resolve));
  releases.shift()();
 }
 results.push(...await Promise.all(jobs));
 assert.deepEqual(results,Array.from({length:100},(_,i)=>i));
 assert.equal(peak,2);
 assert.equal(active,0);
});

test('photo queue continues after failure and normalizes invalid concurrency',async()=>{
 const run=createTaskQueue(0);
 await assert.rejects(run(async()=>{throw Error('decode failed')}),/decode failed/);
 assert.equal(await run(async()=>42),42);
 await assert.rejects(run(null),TypeError);
});
