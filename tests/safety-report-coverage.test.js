import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportCoverageAssessment,safetyReportSnapshot} from '../src/safety-intelligence-report.js';

test('coverage only reports verifiable aggregate figures',()=>{
 const current={observations:{count:5},daily_reports:{count:4,unsafe:1},incidents:{count:2},equipment_inspections:{count:3},disciplinary_actions:{count:1},safety_tools:{count:2}};
 const previous={observations:{count:4},daily_reports:{count:2},incidents:{count:1},equipment_inspections:{count:1},disciplinary_actions:{count:0},safety_tools:{count:1}};
 const a=reportCoverageAssessment(current,previous);
 assert.equal(a.total,17);
 assert.equal(a.prior,9);
 assert.equal(a.activeSources,6);
 assert.equal(a.dailyShare,23.5);
 assert.equal(a.unsafeShare,25);
 assert.equal(a.changeRate,88.9);
 assert.deepEqual(a.limitedSources,[]);
});
test('missing baseline, no records and sampled rows never fabricate confidence',()=>{
 const zero=reportCoverageAssessment({},{});
 assert.equal(zero.changeRate,null);
 assert.equal(zero.unsafeShare,null);
 assert.equal(zero.comparability,'no_baseline');
 const limited=reportCoverageAssessment({daily_reports:{count:1600,unsafe:30,sample_limited:true}},{daily_reports:{count:20}});
 assert.equal(limited.total,1600);
 assert.equal(limited.unsafeShare,null);
 assert.deepEqual(limited.limitedSources,['daily_reports']);
 const snapshot=safetyReportSnapshot({cadence:'weekly',metrics:{current:{daily_reports:{count:1600,sample_limited:true}},previous:{}}},'Rivage');
 assert.equal(snapshot.coverage.dailyReports,1600);
 assert.equal(snapshot.coverage.unsafeShare,null);
});
