import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = source.indexOf('function renderPageWithLoading(');
const end = source.indexOf('\nfunction renderPage', start);
const helper = source.slice(start, end);

test('async page loading feedback paints before route work starts', () => {
  assert.notEqual(start, -1, 'loading helper exists');
  assert.notEqual(end, -1, 'loading helper ends before renderPage');
  const frames = [];
  const rendered = [];
  let loaded = false;
  const context = vm.createContext({
    frame: markup => rendered.push(markup),
    esc: value => value,
    requestAnimationFrame: callback => frames.push(callback),
  });

  vm.runInContext(helper, context);
  context.renderPageWithLoading(() => { loaded = true; }, 'Loading inventory…');

  assert.equal(rendered.length, 1);
  assert.match(rendered[0], /role="status"/);
  assert.match(rendered[0], /aria-live="polite"/);
  assert.match(rendered[0], /aria-busy="true"/);
  assert.match(rendered[0], /Loading inventory…/);
  assert.equal(loaded, false, 'route work waits for the browser paint frame');
  assert.equal(frames.length, 1);

  frames[0]();
  assert.equal(loaded, true);
});
