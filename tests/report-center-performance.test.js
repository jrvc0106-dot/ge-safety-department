import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAst} from 'rollup/parseAst';
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(main);
const body=name=>{
 const fn=ast.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name===name);
 assert.ok(fn,'Expected '+name+' to exist');
 return main.slice(fn.start,fn.end);
};
const center=body('reportCenter'),report=body('safetyWalkReport');

test('Report Center reads only JHA listing fields, not every checklist entry or inspector note',()=>{
 const query=center.match(/db\.from\('daily_safety_walks'\)\.select\('([^']+)'\)/);
 assert.ok(query,'JHA list query');
 const select=query[1];
 assert.match(select,/id,created_at,overall_status,created_by/);
 assert.match(select,/creator:profiles!/,'Safety name is kept');
 assert.doesNotMatch(select,/(?:items:|daily_safety_walk_items|\bnotes\b)/);
 assert.match(center,/groupFinalWalkReportsByCreator\(/,'original author groups remain');
 assert.match(center,/indexFinalPdfDocuments\(registered,state\.project\)/,'final archived PDF access remains');
 assert.match(center,/reportCenterHidden\(trashEntries/,'admin trash filtering remains');
 assert.match(center,/function draw\(key\)/,'all report categories remain');
});

test('JHA detail still retrieves every item, finding, correction, signed photo and report version',()=>{
 assert.match(report,/items:daily_safety_walk_items\(\*,photos:daily_safety_walk_photos\(id,path,kind\)\)/);
 assert.match(report,/const revisionPromise=db\.from\('report_documents'\)/);
 assert.match(report,/signedDisplayImage\('daily-safety-walks',p\.path,3600\)/);
 assert.match(report,/jhaSignaturesReport\(w\.approvals,tr\)/);
 assert.match(report,/jhaPhotoPageGroups\(evidencePhotoCards,evidenceHeading\)/);
});
