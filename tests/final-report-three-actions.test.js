import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAst} from 'rollup/parseAst';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(source);
const method=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='installReportDocumentActions');
test('final report action bar contains View, Download and Share in that order',()=>{
 const snippet=source.slice(method.start,method.end);
 assert.match(snippet,/class="secondary pdf-view"/);
 assert.match(snippet,/class="pdf-download"/);
 assert.match(snippet,/class="secondary pdf-share"/);
 assert.ok(snippet.indexOf('pdf-view')<snippet.indexOf('pdf-download'));
 assert.ok(snippet.indexOf('pdf-download')<snippet.indexOf('pdf-share'));
 assert.doesNotMatch(snippet,/class="pdf-save"/);
 assert.match(snippet,/attachJhaPdfActions\(actions,report/);
});
test('final report actions do not modify Report Center or PDF rendering',()=>{
 assert.match(source,/const reportActionObserver=new MutationObserver/);
 assert.match(source,/if\(report\)\{installReportDocumentActions\(\)/);
 assert.match(source,/async function buildReportPdf\(highQuality=false\)/);
});
