import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAst} from 'rollup/parseAst';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(source);
const node=ast.body.find(item=>item.type==='FunctionDeclaration'&&item.id.name==='admin');
const adminSource=source.slice(node.start,node.end);

test('project names can be edited from the admin project page',()=>{
  assert.match(adminSource,/project-name-form/);
  assert.match(adminSource,/data-project-id=/);
  assert.match(adminSource,/input name="name" required maxlength="120"/);
});

test('editing project details saves name and address only and remains admin-only',()=>{
  assert.match(adminSource,/state\.profile\.role!=='admin'/);
  assert.match(adminSource,/state\.projects\.map\(project=>/);
  assert.match(adminSource,/input name="address" maxlength="240" value=/);
  assert.match(adminSource,/update\(\{name,address\}\)\.eq\('id',projectId\)\.select\('id'\)\.single\(\)/);
  assert.doesNotMatch(adminSource,/update\(\{name,address,general_contractor/);
});
