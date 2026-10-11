import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canAccessAdminOnlyPage,adminOnlyAccessMessage} from '../src/admin-only-access.js';
import {canReadTool,isAdminOnlyTool} from '../src/safety-tools-model.js';

test('administrator-only pages stay visible but reject non-admin roles',()=>{
  for(const page of ['admin','manageProjects','cloudBackup']){
    assert.equal(canAccessAdminOnlyPage('admin',page),true);
    for(const role of ['safety_director','safety','supervisor','worker']){
      assert.equal(canAccessAdminOnlyPage(role,page),false,role+' cannot enter '+page);
    }
  }
  assert.equal(canAccessAdminOnlyPage('worker','home'),true);
});

test('administrator-only tool cards remain visible and cannot be opened by other roles',()=>{
  assert.equal(isAdminOnlyTool('director'),true);
  assert.equal(canReadTool('director','admin'),true);
  for(const role of ['safety_director','safety','supervisor','worker']){
    assert.equal(canReadTool('director',role),false);
  }
  const safetyTools=readFileSync(new URL('../src/safety-tools.js',import.meta.url),'utf8');
  assert.match(safetyTools,/canReadTool\(k,role\)\|\|isAdminOnlyTool\(k\)/);
  assert.match(safetyTools,/admin-only-lock/);
});

test('the restricted-access message is exact in Spanish and clear in English',()=>{
  assert.equal(adminOnlyAccessMessage((en,es)=>es),'Acceso Restringido Solo Para Administradores');
  assert.equal(adminOnlyAccessMessage((en,es)=>en),'Restricted Access: Administrators Only');
});

test('Cloud Backup is listed for every signed-in role and its route remains guarded',()=>{
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(main,/<button class="home-action cloud-backup-module" id="home-cloud-backup"/);
  assert.match(main,/canAccessAdminOnlyPage\(state\.profile\.role,'cloudBackup'\)/);
});
