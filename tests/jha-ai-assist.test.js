import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAst} from 'rollup/parseAst';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/improve-writing/index.ts',import.meta.url),'utf8');
const ast=parseAst(source);
const getFunction=name=>{
  const node=ast.body.find(item=>item.type==='FunctionDeclaration'&&item.id.name===name);
  assert.ok(node, 'expected function '+name);
  return source.slice(node.start,node.end);
};

test('JHA form offers review suggestions without editing or saving the draft',()=>{
  const form=getFunction('safetyWalk'),review=getFunction('attachJhaReview');
  assert.match(form,/id="review-jha-ai"/);
  assert.match(form,/id="jha-ai-review-result"/);
  assert.match(form,/data-jha-dictation="true"/);
  assert.match(review,/action:'review_jha'/);
  assert.match(review,/data-index=/);
  assert.doesNotMatch(review,/\.from\([^)]*\)\.(insert|update|upsert)\(/);
});

test('voice dictation is limited to marked JHA text fields and has a browser fallback',()=>{
  const dictation=getFunction('attachJhaDictation');
  assert.match(dictation,/textarea\[data-jha-dictation="true"\]/);
  assert.match(dictation,/SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  assert.match(dictation,/Microphone permission was denied/);
  assert.match(dictation,/keyboard microphone/);
  assert.match(dictation,/field\.readOnly=false/);
});

test('JHA AI endpoint validates roles, project access, payload size and structured suggestions',()=>{
  assert.match(edge,/\["admin","safety_director","safety","supervisor"\]/);
  assert.match(edge,/project_members/);
  assert.match(edge,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge,/reviewedCharacters>12000/);
  assert.match(edge,/responseFormat/);
  assert.match(edge,/suggestions/);
  assert.match(edge,/No additional detail|You edit construction safety field notes/);
});
