import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalRecordRepository, validateLocalRecord, LOCAL_COLLECTIONS
} from '../native/local-record-contract.mjs';

function driver() {
  const data = new Map();
  const key = (collection,id) => collection + ':' + id;
  return {
    async get(collection,id) { return data.get(key(collection,id)) ?? null; },
    async upsert(record) { data.set(key(record.collection,record.id),record); },
    async list(collection,projectId) {
      return [...data.values()].filter(row => row.collection === collection && row.project_id === projectId);
    }
  };
}
test('all planned report collections have a local data contract', () => {
  for (const collection of ['observations','incident_reports','safety_tool_records','equipment_inspections','quick_safety_orientations','report_documents']) {
    assert.ok(LOCAL_COLLECTIONS.includes(collection),collection);
  }
});
test('save keeps stable IDs and increments revisions', async () => {
  const store = createLocalRecordRepository(driver(),{now:()=> '2026-10-12T00:00:00.000Z'});
  const base = {collection:'observations',id:'report-1',project_id:'project-1',payload:{status:'open'}};
  assert.equal((await store.save(base)).revision,1);
  assert.equal((await store.save({...base,payload:{status:'closed'}})).revision,2);
  assert.equal((await store.list('observations','project-1')).length,1);
  assert.equal((await store.list('observations','project-2')).length,0);
});
test('rejects project cross-over and path traversal for attachments', async () => {
  const store = createLocalRecordRepository(driver());
  await store.save({collection:'incident_reports',id:'id-1',project_id:'a',payload:{}});
  await assert.rejects(store.save({collection:'incident_reports',id:'id-1',project_id:'b',payload:{}}),/another project/);
  assert.throws(()=>validateLocalRecord({
    collection:'observations',id:'id-2',project_id:'a',payload:{},
    attachments:[{path:'../secrets',size:4,sha256:'a'.repeat(64)}]
  }),/Invalid attachment/);
});
test('rejects records without project or with invalid payload', () => {
  assert.throws(()=>validateLocalRecord({collection:'observations',id:'a',project_id:'',payload:{}}));
  assert.throws(()=>validateLocalRecord({collection:'observations',id:'a',project_id:'p',payload:[]}));
});
