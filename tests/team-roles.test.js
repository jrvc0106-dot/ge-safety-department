import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TEAM_ROLES,teamRoleLabel,isAssignableTeamRole} from '../src/team-roles.js';

test('superintendent is available as a separate assignable role',()=>{
 assert.ok(isAssignableTeamRole('superintendent'));
 assert.ok(isAssignableTeamRole('supervisor'));
 assert.notEqual('superintendent','supervisor');
 assert.equal(isAssignableTeamRole('admin'),false);
});

test('team roles have clear bilingual profile labels',()=>{
 const tr=(en,es)=>es;
 assert.equal(teamRoleLabel('superintendent',tr),'Superintendente');
 assert.equal(teamRoleLabel('supervisor',tr),'Supervisor');
 assert.equal(teamRoleLabel('safety_director',tr),'Director de Safety');
 assert.equal(teamRoleLabel('admin',tr),'Administrador');
 assert.equal(TEAM_ROLES.length,5);
});
