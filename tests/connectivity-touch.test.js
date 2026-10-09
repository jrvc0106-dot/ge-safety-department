import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('coarse-pointer controls preserve iPad and phone touch target and readable text sizes',()=>{
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(css,/@media\s*\(any-pointer:\s*coarse\)/);
 assert.match(css,/font-size:\s*16px\s*!important/);
 assert.match(css,/min-height:\s*44px\s*!important/);
 assert.match(css,/#ge-connectivity-status/);
});
