import test from 'node:test';
import assert from 'node:assert/strict';
import {createSQLiteRecordAdapter} from '../native/sqlite-record-adapter.mjs';
import {createLocalRecordRepository} from '../native/local-record-contract.mjs';

test('SQLite adapter uses parameters and persists report records by project',async()=>{
  const rows=new Map();const key=(type,id)=>type+':'+id;
  const connection={
    async execute(sql){assert.match(sql,/CREATE/);},
    async query(sql,args){
      assert.ok(sql.includes('?'));
      if(sql.includes('AND id = ?')){
        const row=rows.get(key(args[0],args[1]));
        return {values:row?[row]:[]};
      }
      return {values:[...rows.values()].filter(row=>row.collection===args[0]&&row.project_id===args[1])};
    },
    async run(sql,args){
      assert.ok(sql.includes('ON CONFLICT'));assert.equal(args.length,6);
      const [collection,id,project_id,revision,updated_at,body]=args;
      const old=rows.get(key(collection,id));
      if(old && (old.project_id!==project_id || JSON.parse(old.body).revision>=revision))
        return {changes:{changes:0}};
      rows.set(key(collection,id),{collection,id,project_id,body});
      return {changes:{changes:1}};
    }
  };
  const adapter=await createSQLiteRecordAdapter(connection);
  const repo=createLocalRecordRepository(adapter);
  await repo.save({collection:'safety_tool_records',id:'r-1',project_id:'job-1',payload:{kind:'toolbox'}});
  assert.equal((await repo.get('safety_tool_records','r-1')).revision,1);
  assert.equal((await repo.list('safety_tool_records','job-1')).length,1);
  assert.equal((await repo.list('safety_tool_records','job-2')).length,0);
});
test('SQLite adapter cannot silently accept an overwrite with stale revision',async()=>{
  const connection={
    async execute(){},async query(){return {values:[]}},
    async run(){return {changes:{changes:0}}}
  };
  const adapter=await createSQLiteRecordAdapter(connection);
  await assert.rejects(adapter.upsert({
    collection:'observations',id:'r-1',project_id:'p-1',
    revision:2,updated_at:new Date().toISOString(),payload:{}
  }),/Stale write/);
});
