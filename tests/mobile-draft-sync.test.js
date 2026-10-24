import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const ast=parseAst(source);
const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='syncPendingDraftEvidence');
if(!node)throw Error('Pending GE ONE draft evidence sync not found');
const syncSource=source.slice(node.start,node.end);

function fixture({cloudError=false,localWriteFails=false,uploadError=false}={}){
 const key='ge_draft_v1:safety:job:daily_safety_walk:default';
 const record={updated_at:'2026-10-24T10:00:00Z',payload:{
  notes:'Check fall protection before pour',
  __files:{photos_0:[{localId:'local-evidence',path:'safety/job/daily_safety_walk/photo.jpg',type:'image/jpeg',name:'image.jpg'}]}
 }};
 const storage=new Map([[key,JSON.stringify(record)]]);
 const deleted=[],uploaded=[],cloudWrites=[],errors=[];
 const files=new Map([['draft-key',{photos_0:[{...record.payload.__files.photos_0[0]}]}]]);
 const context=vm.createContext({
  state:{profile:{id:'safety'},projects:[{id:'job'}]},
  localStorage:{
   get length(){return storage.size},
   key:i=>[...storage.keys()][i]||null,
   getItem:k=>storage.get(k)||null,
   setItem(k,v){if(localWriteFails)throw Error('Storage quota exhausted');storage.set(k,v)}
  },
  db:{
   storage:{from:()=>({upload:async(path,file)=>{uploaded.push({path,file});return {error:uploadError?Error('No network'):null}}})},
   from:()=>({upsert:async value=>{cloudWrites.push(value);return {error:cloudError?Error('RLS permission rejected'):null}}})
  },
  getOfflineDraftFile:async id=>id==='local-evidence'?{name:'image.jpg',type:'image/jpeg',size:8}:null,
  deleteOfflineDraftFiles:async ids=>deleted.push(...ids),
  draftFileState:files,document:{querySelectorAll:()=>[]},renderDraftFileBadges:()=>{},
  formDraftKey:()=> 'draft-key',DRAFT_FORMS:{'walk-form':'daily_safety_walk'},
  error:e=>errors.push(e),
 });
 vm.runInContext(syncSource,context);
 return {context,key,storage,record,files,deleted,uploaded,cloudWrites,errors};
}

test('offline JHA evidence is never discarded when cloud metadata rejects an upload',async()=>{
 const t=fixture({cloudError:true});
 await t.context.syncPendingDraftEvidence();
 assert.equal(t.uploaded.length,1);
 assert.equal(t.deleted.length,0);
 assert.equal(t.storage.get(t.key).includes('"localId":"local-evidence"'),true);
 assert.equal(t.files.get('draft-key').photos_0[0].localId,'local-evidence');
 assert.equal(t.cloudWrites.length,1);
 assert.equal(t.errors.length,0);
});

test('offline JHA evidence is not discarded if iPhone local storage update fails',async()=>{
 const t=fixture({localWriteFails:true});
 await t.context.syncPendingDraftEvidence();
 assert.equal(t.deleted.length,0);
 assert.equal(t.files.get('draft-key').photos_0[0].localId,'local-evidence');
 assert.equal(t.storage.get(t.key).includes('"localId":"local-evidence"'),true);
});

test('confirmed cloud upload and saved metadata release local photo only after both stores succeed',async()=>{
 const t=fixture();
 await t.context.syncPendingDraftEvidence();
 assert.deepEqual(t.deleted,['local-evidence']);
 assert.equal(t.files.get('draft-key').photos_0[0].localId,undefined);
 const updated=JSON.parse(t.storage.get(t.key));
 assert.equal(updated.payload.notes,'Check fall protection before pour');
 assert.equal(updated.payload.__files.photos_0[0].localId,undefined);
 assert.equal(t.cloudWrites[0].payload.__files.photos_0[0].localId,undefined);
 assert.equal(t.uploaded.length,1);
});
test('unavailable upload leaves local-only draft evidence untouched',async()=>{
 const t=fixture({uploadError:true});
 await t.context.syncPendingDraftEvidence();
 assert.equal(t.cloudWrites.length,0);
 assert.equal(t.deleted.length,0);
 assert.equal(t.files.get('draft-key').photos_0[0].localId,'local-evidence');
});
