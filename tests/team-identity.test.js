import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMemberEmail,matchOrientationWarnings,summarizeOrientationWarnings,isFormalOrientationWarning} from '../src/team-identity.js';

test('normalizes valid email addresses from any domain',()=>{
 assert.equal(normalizeMemberEmail('  Worker+Field@Example.org  '),'worker+field@example.org');
});
test('rejects malformed email addresses without restricting company domains',()=>{
 for(const value of ['', 'worker', 'worker@localhost', 'worker@@example.org', 'worker..name@example.org', 'worker@-example.org']){
  assert.equal(normalizeMemberEmail(value),null,value);
 }
});
test('linked orientation warnings match by employee id even when names collide',()=>{
 const orientation={employee_profile_id:'employee-1',employee_name:'Alex Smith'};
 const records=[
  {employee_id:'employee-1',employee_name:'Alex Smith',id:'match'},
  {employee_id:'employee-2',employee_name:'Alex Smith',id:'different'}
 ];
 assert.deepEqual(matchOrientationWarnings(orientation,records).map(x=>x.id),['match']);
});
test('legacy unlinked orientations keep exact normalized-name matching',()=>{
 const records=[
  {employee_id:null,employee_name:'  José  Rivera ',id:'legacy'},
  {employee_id:'employee-1',employee_name:'Other Person',id:'other'}
 ];
 assert.deepEqual(matchOrientationWarnings({employee_name:'José Rivera'},records).map(x=>x.id),['legacy']);
 assert.deepEqual(matchOrientationWarnings({},records),[]);
});

test('summarizes warning counts by violation type and handles missing types',()=>{
 const summary=summarizeOrientationWarnings([
  {violation_type:'Fall Protection'},
  {violation_type:'Housekeeping'},
  {violation_type:'Fall Protection'},
  {violation_type:'  '}
 ]);
 assert.deepEqual(summary,[
  {type:'Fall Protection',count:2},
  {type:'Housekeeping',count:1},
  {type:'Unspecified',count:1}
 ]);
});

test('linked orientation includes exact-name legacy rows but excludes other linked employees with same name',()=>{
 const orientation={employee_profile_id:'employee-1',employee_name:'Alex Smith'};
 const records=[
  {employee_id:'employee-1',employee_name:'Alex Smith',id:'linked'},
  {employee_id:null,employee_name:'  alex   smith ',id:'legacy'},
  {employee_id:'employee-2',employee_name:'Alex Smith',id:'other'}
 ];
 assert.deepEqual(matchOrientationWarnings(orientation,records).map(x=>x.id),['linked','legacy']);
});
test('only verbal, written and final notices count as formal warnings',()=>{
 assert.equal(isFormalOrientationWarning({action_level:'verbal_warning'}),true);
 assert.equal(isFormalOrientationWarning({action_level:'written_warning'}),true);
 assert.equal(isFormalOrientationWarning({action_level:'final_warning'}),true);
 assert.equal(isFormalOrientationWarning({action_level:'coaching'}),false);
 assert.equal(isFormalOrientationWarning({action_level:'removal_suspension'}),false);
});

test('unlinked orientation does not inherit a linked warning by a possibly duplicated name',()=>{
 const records=[
  {employee_id:'employee-1',employee_name:'Jordan Lee',id:'linked'},
  {employee_id:null,employee_name:'Jordan Lee',id:'legacy'}
 ];
 assert.deepEqual(matchOrientationWarnings({employee_name:'Jordan Lee'},records).map(x=>x.id),['legacy']);
});
