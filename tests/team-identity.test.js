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

test('sticker warnings match only the exact orientation record id',()=>{
 const orientation={id:'orientation-1',employee_profile_id:'employee-1',employee_name:'Alex Smith'};
 const records=[
  {employee_orientation_id:'orientation-1',employee_id:'employee-1',employee_name:'Alex Smith',id:'direct'},
  {employee_orientation_id:'orientation-2',employee_id:'employee-1',employee_name:'Alex Smith',id:'other-sticker'},
  {employee_orientation_id:null,employee_id:'employee-1',employee_name:'Alex Smith',id:'profile-only'},
  {employee_orientation_id:null,employee_id:null,employee_name:'Alex Smith',id:'legacy-name'}
 ];
 assert.deepEqual(matchOrientationWarnings(orientation,records).map(x=>x.id),['direct']);
});
test('an orientation without an id does not match profile, name, or unlinked history',()=>{
 const records=[
  {employee_orientation_id:'orientation-1',employee_name:'Jordan Lee',id:'linked'},
  {employee_orientation_id:null,employee_id:null,employee_name:'Jordan Lee',id:'legacy'}
 ];
 assert.deepEqual(matchOrientationWarnings({employee_name:'Jordan Lee'},records),[]);
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

test('only verbal, written and final notices count as formal warnings',()=>{
 assert.equal(isFormalOrientationWarning({action_level:'verbal_warning'}),true);
 assert.equal(isFormalOrientationWarning({action_level:'written_warning'}),true);
 assert.equal(isFormalOrientationWarning({action_level:'final_warning'}),true);
 assert.equal(isFormalOrientationWarning({action_level:'coaching'}),false);
 assert.equal(isFormalOrientationWarning({action_level:'removal_suspension'}),false);
});
