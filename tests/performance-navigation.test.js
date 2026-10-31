import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(source);
const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='renderPageWithLoading');
const deferredSource=source.slice(node.start,node.end);
test('navigating away before the next animation frame cancels stale page work',()=>{
 const callbacks=[],frames=[];
 const ctx=vm.createContext({frame:html=>frames.push(html),esc:x=>x,requestAnimationFrame:cb=>callbacks.push(cb)});
 vm.runInContext('let renderRevision=1;\n'+deferredSource,ctx);
 let calls=0;
 ctx.renderPageWithLoading(()=>{calls++},'Opening report');
 assert.equal(callbacks.length,1);
 assert.equal(frames.length,1);
 vm.runInContext('renderRevision=2',ctx);
 callbacks.shift()();assert.equal(calls,0);
 ctx.renderPageWithLoading(()=>{calls++},'Opening current report');
 callbacks.shift()();assert.equal(calls,1);
});

test('observations cache holds at most five jobsite lists',()=>{
 const start=source.indexOf('const projectObservationsCache=');
 const end=source.indexOf('// The selected jobsite is a per-account device preference',start);
 assert.ok(start>=0&&end>start);
 const ctx=vm.createContext({});
 vm.runInContext(source.slice(start,end),ctx);
 for(let i=0;i<12;i++)ctx.retainProjectObservations('job-'+i,[{id:i}]);
 assert.equal(vm.runInContext('projectObservationsCache.size',ctx),5);
 assert.equal(vm.runInContext("projectObservationsCache.has('job-11')",ctx),true);
 assert.equal(vm.runInContext("projectObservationsCache.has('job-0')",ctx),false);
});
