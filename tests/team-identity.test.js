import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMemberEmail,matchOrientationWarnings} from '../src/team-identity.js';

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
