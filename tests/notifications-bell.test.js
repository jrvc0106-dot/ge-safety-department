import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAst} from 'rollup/parseAst';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const ast=parseAst(source);
const node=ast.body.find(item=>item.type==='FunctionDeclaration'&&item.id.name==='frame');
const frameSource=source.slice(node.start,node.end);

test('notification bell has a modern, accessible icon control',()=>{
  assert.match(frameSource,/id="notification-menu"[^>]*aria-label=/);
  assert.match(frameSource,/<svg viewBox="0 0 24 24" aria-hidden="true"/);
  assert.match(frameSource,/id="notification-count" aria-hidden="true"/);
  assert.match(styles,/header nav \.notification-menu:focus-visible/);
  assert.match(styles,/header nav \.notification-menu:hover/);
});

test('unread notification count stays visible and is announced accessibly',()=>{
  assert.match(frameSource,/el\.textContent=count>99\?'99\+':String\(count\)/);
  assert.match(frameSource,/button\.classList\.add\('has-unread'\)/);
  assert.match(frameSource,/button\.setAttribute\('aria-label'/);
  assert.match(styles,/prefers-reduced-motion:reduce/);
});
