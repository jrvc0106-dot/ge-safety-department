import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAst} from 'rollup/parseAst';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(source);
const node=ast.body.find(item=>item.type==='FunctionDeclaration'&&item.id.name==='safetyWalk');
const safetyWalkSource=source.slice(node.start,node.end);

test('JHA saving does not wait for the optional jobsite weather lookup',()=>{
  const lookupAt=safetyWalkSource.indexOf('weatherTask=captureJobsiteWeather(project)');
  const submitAt=safetyWalkSource.indexOf('.onsubmit=async ev=>');
  assert.ok(lookupAt>=0&&submitAt>lookupAt,'weather lookup should start while the form is open');
  assert.doesNotMatch(safetyWalkSource,/\\bawait\\s+captureJobsiteWeather\\s*\\(/);
});

test('a late JHA weather result is saved to the same jobsite report',()=>{
  assert.match(safetyWalkSource,/weather_snapshot:weatherForSave/);
  assert.match(safetyWalkSource,/update\\(\\{weather_snapshot:snapshot\\}\\)\\.eq\\('id',walkId\\)\\.eq\\('project_id',formProjectId\\)/);
});
