import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safetyTrendTotal,safetyTrendDelta} from '../src/safety-intelligence.js';
test('counts across sources without creating a safety score',()=>{
 assert.equal(safetyTrendTotal({observations:{count:3},incidents:{count:2},walks:{count:7}}),12);
 assert.equal(safetyTrendTotal({}),0);
});
test('compares equal period report counts',()=>{
 assert.equal(safetyTrendDelta(3,7),-4);
 assert.equal(safetyTrendDelta(9,4),5);
});
test('scheduler uses only aggregate non-personal fields and verifies the secret',()=>{
 const source=readFileSync('supabase/functions/safety-trends-scheduler/index.ts','utf8');
 assert.match(source,/verify_safety_trend_job_token/);
 assert.match(source,/x-ge-cron-key/);
 assert.match(source,/\.eq\("project_id",setting\.project_id\)/);
 assert.match(source,/No employee identities|Never access narrative text/);
 assert.doesNotMatch(source,/employee_name,employee_dob|select\("\*"/);
});
test('new report settings have project-level RLS and only two cadences',()=>{
 const sql=readFileSync('supabase/migrations/20261017000000_automatic_safety_intelligence.sql','utf8');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/check \(cadence in \('weekly','monthly'\)\)/);
 assert.match(sql,/grant update\(cadence,enabled,next_run_at,updated_at\)/);
});
