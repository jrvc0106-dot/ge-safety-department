import test from 'node:test';import assert from 'node:assert/strict';
import {HIRING_SOURCE_FIELDS,HIRING_EMPLOYER_FIELDS,HIRING_SIGNATURE_FIELDS,hiringFieldAudit,hiringSafeFolderName} from '../src/hiring-form-schema.js';
test('the original PDF maps exactly 57 named fields across eight pages',()=>{
 assert.equal(Object.values(HIRING_SOURCE_FIELDS).flat().length,57);
 assert.deepEqual(Object.keys(HIRING_SOURCE_FIELDS).map(Number),[1,2,3,4,5,6,7,8]);
 assert.equal(HIRING_SOURCE_FIELDS[8].length,0);
});
test('employer-only fields cannot be interpreted as applicant omissions',()=>{
 const audit=hiringFieldAudit({},'applicant');
 assert.equal(audit.missing.some(item=>HIRING_EMPLOYER_FIELDS.has(item.field)),false);
 assert.equal(audit.blocked.length,HIRING_EMPLOYER_FIELDS.size);
 assert.equal(audit.complete,false);
 assert.ok(audit.missing.some(item=>item.field==='I9_Employee_Signature_Typed'&&item.signature));
});
test('employer and applicant signatures are independently required',()=>{
 const employer=hiringFieldAudit({},'employer'),applicant=hiringFieldAudit({},'applicant');
 assert.ok(employer.missing.some(item=>item.field==='I9_Employer_Signature_Typed'));
 assert.ok(!applicant.missing.some(item=>item.field==='I9_Employer_Signature_Typed'));
 assert.equal(HIRING_SIGNATURE_FIELDS.size,6);
});
test('Dropbox folder labels reject traversal and unsafe characters',()=>{
 assert.equal(hiringSafeFolderName('../García','Ana/María'),'Garcia, AnaMaria');
 assert.throws(()=>hiringSafeFolderName('','Ana'));
});
