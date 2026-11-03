import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createExpiringRequestCache} from '../src/performance-cache.js';

test('rapid page renders share a single in-flight badge request',async()=>{
 let resolve,fetches=0,time=0;
 const cache=createExpiringRequestCache({ttl:8000,now:()=>time});
 const fetch=()=>{fetches++;return new Promise(done=>{resolve=done})};
 const a=cache.get('safety-1',fetch),b=cache.get('safety-1',fetch);
 assert.strictEqual(a,b);
 await Promise.resolve();
 assert.equal(fetches,1);
 resolve({count:4});assert.deepEqual(await a,{count:4});
 assert.deepEqual(await cache.get('safety-1',fetch),{count:4});
 assert.equal(fetches,1);
 time=8001;const c=cache.get('safety-1',fetch);await Promise.resolve();
 assert.equal(fetches,2);resolve({count:3});assert.equal((await c).count,3);
});

test('badge cache is bounded and keeps one user separate from another',async()=>{
 let requests=0;
 const cache=createExpiringRequestCache({limit:2});
 for(const key of ['safety-a','safety-b','safety-c']){
  await cache.get(key,async()=>({count:++requests}));
 }
 assert.equal(cache.size,2);
 assert.equal((await cache.get('safety-c',async()=>({count:99}))).count,3);
 assert.equal((await cache.get('safety-a',async()=>({count:++requests}))).count,4);
 cache.invalidate('safety-c');
 assert.equal(cache.size,1);
});

test('a failed badge request is not cached and can be retried',async()=>{
 let attempts=0;const cache=createExpiringRequestCache();
 await assert.rejects(cache.get('worker',async()=>{attempts++;throw Error('offline')}),/offline/);
 assert.equal(cache.size,0);
 assert.equal((await cache.get('worker',async()=>({count:++attempts}))).count,2);
});

test('a response arriving after invalidation does not poison the cache',async()=>{
 let resolve;
 const cache=createExpiringRequestCache();
 const pending=cache.get('worker',()=>new Promise(done=>{resolve=done}));
 await Promise.resolve();
 cache.invalidate('worker');
 const fresh=await cache.get('worker',async()=>({count:0}));
 resolve({count:9});
 assert.equal((await pending).count,9);
 assert.equal((await cache.get('worker',async()=>({count:8}))).count,0);
 assert.equal(fresh.count,0);
});

test('cache evicts expired records before fresh badge data',async()=>{
 let time=0;
 const cache=createExpiringRequestCache({ttl:100,limit:2,now:()=>time});
 let calls=0;
 await cache.get('expired',async()=>({count:++calls}));
 time=110;
 await cache.get('fresh',async()=>({count:++calls}));
 await cache.get('newest',async()=>({count:++calls}));
 assert.equal(cache.size,2);
 assert.equal((await cache.get('fresh',async()=>({count:++calls}))).count,2);
 assert.equal(calls,3);
});
test('cache prefers in-flight requests over completed entries when capacity is full',async()=>{
 const cache=createExpiringRequestCache({limit:2});
 let finish;
 const work=cache.get('still-loading',()=>new Promise(resolve=>{finish=resolve}));
 await Promise.resolve();
 await cache.get('complete',async()=>({count:1}));
 await cache.get('new',async()=>({count:2}));
 const duplicate=cache.get('still-loading',()=>({count:100}));
 assert.strictEqual(duplicate,work);
 finish({count:3});
 assert.equal((await duplicate).count,3);
});
