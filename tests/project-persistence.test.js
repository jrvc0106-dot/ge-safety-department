import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(source);
const extract=name=>{
 const node=ast.body.find(item=>item.type==='FunctionDeclaration'&&item.id.name===name);
 assert.ok(node, 'Missing function '+name);
 return source.slice(node.start,node.end);
};
const helpers=['projectPreferenceKey','readSelectedProject','persistSelectedProject','resolveSelectedProject']
 .map(extract).join('\n');

function scenario(storageOverride=null){
 const records=new Map(),storage=storageOverride||{
  getItem:key=>records.get(key)||null,
  setItem:(key,value)=>records.set(key,value)
 };
 const context=vm.createContext({localStorage:storage});
 vm.runInContext("const PROJECT_PREFERENCE_PREFIX='ge_selected_project_v1:';\n"+helpers,context);
 return {context,records};
}

const projects=[{id:'domus'},{id:'rivage'}];

test('a manual project selection survives a fresh page context for the same account',()=>{
 const t=scenario();
 t.context.persistSelectedProject('worker-1','rivage');
 assert.equal(t.context.readSelectedProject('worker-1'),'rivage');
 assert.equal(t.context.resolveSelectedProject('worker-1',projects,null,null),'rivage');
 assert.equal(t.context.resolveSelectedProject('worker-1',[...projects].reverse(),null,null),'rivage');
});

test('each account remembers its own project on the same iPad',()=>{
 const t=scenario();
 t.context.persistSelectedProject('director','rivage');
 t.context.persistSelectedProject('foreman','domus');
 assert.equal(t.context.resolveSelectedProject('director',projects,'domus','foreman'),'rivage');
 assert.equal(t.context.resolveSelectedProject('foreman',projects,'rivage','director'),'domus');
 assert.equal(t.records.size,2);
});

test('an accessible active project is kept when no preference was previously saved',()=>{
 const t=scenario();
 assert.equal(t.context.resolveSelectedProject('worker',projects,'rivage','worker'),'rivage');
 assert.equal(t.context.resolveSelectedProject('new-worker',projects,'rivage','worker'),'domus');
});

test('a project without permission is never restored from device storage',()=>{
 const t=scenario();t.context.persistSelectedProject('worker','rivage');
 const allowed=[{id:'domus'}];
 assert.equal(t.context.resolveSelectedProject('worker',allowed,'rivage','worker'),'domus');
 assert.equal(t.context.resolveSelectedProject('worker',[],null,'worker'),null);
});

test('project changes continue to work if device storage is unavailable',()=>{
 const t=scenario({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}});
 assert.doesNotThrow(()=>t.context.persistSelectedProject('worker','rivage'));
 assert.equal(t.context.resolveSelectedProject('worker',projects,'rivage','worker'),'rivage');
});
