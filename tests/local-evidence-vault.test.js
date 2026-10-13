import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalEvidenceVault} from '../native/local-evidence-vault.mjs';
import {createCapacitorFileDriver} from '../native/capacitor-file-driver.mjs';

function fakeDriver() {
  const files = new Map();
  return {
    files,
    async read(path) { return files.has(path) ? new Uint8Array(files.get(path)) : null; },
    async write(path,bytes) { files.set(path,new Uint8Array(bytes)); },
    async move(from,to) {
      if(!files.has(from)) throw Error('not found');
      files.set(to,files.get(from)); files.delete(from);
    },
    async remove(path) { files.delete(path); }
  };
}
const contents = new Uint8Array([0, 1, 255, 42, 75, 7]);

test('original HEIC image bytes are saved and returned unchanged',async()=>{
  const driver=fakeDriver(), vault=createLocalEvidenceVault(driver);
  const meta=await vault.save({
    projectId:'job-1',recordId:'jha-1',fileName:'example.heic',
    mimeType:'image/heic',bytes:contents
  });
  assert.equal(meta.size,contents.length);
  assert.match(meta.path,/\.heic$/);
  assert.deepEqual(await vault.read(meta,{projectId:'job-1',recordId:'jha-1'}),contents);
  assert.equal(driver.files.size,1);
  assert.equal(await vault.verify(meta,{projectId:'job-1',recordId:'jha-1'}),true);
});

test('repeated saves are idempotent and leave no temporary files',async()=>{
  const driver=fakeDriver(), vault=createLocalEvidenceVault(driver);
  const args={
    projectId:'job-1',recordId:'jha-1',fileName:'sample.pdf',
    mimeType:'application/pdf',bytes:contents
  };
  const first=await vault.save(args), second=await vault.save(args);
  assert.deepEqual(first,second);
  assert.deepEqual([...driver.files.keys()],[first.path]);
});

test('file corruption is detected rather than silently exporting a bad PDF',async()=>{
  const driver=fakeDriver(), vault=createLocalEvidenceVault(driver);
  const args={projectId:'job-1',recordId:'jha-1',mimeType:'application/pdf',bytes:contents};
  const meta=await vault.save(args);
  driver.files.set(meta.path,new Uint8Array([9,9,9,9,9,9]));
  await assert.rejects(vault.read(meta,{projectId:'job-1',recordId:'jha-1'}),/integrity/);
  await assert.rejects(vault.save(args),/integrity/);
});

test('refuses cross-project access, path traversal and unsupported file types',async()=>{
  const vault=createLocalEvidenceVault(fakeDriver());
  const meta=await vault.save({projectId:'job-1',recordId:'jha-1',mimeType:'image/jpeg',bytes:contents});
  await assert.rejects(vault.read(meta,{projectId:'job-2',recordId:'jha-1'}),/different project/);
  await assert.rejects(vault.save({
    projectId:'../job',recordId:'jha-1',mimeType:'image/jpeg',bytes:contents
  }),/Invalid project/);
  await assert.rejects(vault.save({
    projectId:'job-1',recordId:'jha-1',mimeType:'text/html',bytes:contents
  }),/Unsupported/);
});

test('Capacitor filesystem bridge preserves original bytes without recompression',async()=>{
  const files=new Map();
  const Filesystem={
    async readFile({path}) {
      if(!files.has(path))throw Error('File does not exist');
      return {data:files.get(path)};
    },
    async writeFile({path,data}) {files.set(path,data);},
    async rename({from,to}) {
      if(!files.has(from))throw Error('not found');
      files.set(to,files.get(from));files.delete(from);
    },
    async deleteFile({path}) {
      if(!files.has(path))throw Error('not found');
      files.delete(path);
    }
  };
  const driver=createCapacitorFileDriver({Filesystem,Directory:{Data:'DATA'}});
  const vault=createLocalEvidenceVault(driver);
  const meta=await vault.save({
    projectId:'job-1',recordId:'obs-1',mimeType:'image/jpeg',bytes:contents
  });
  assert.deepEqual(await vault.read(meta,{projectId:'job-1',recordId:'obs-1'}),contents);
  assert.equal(files.size,1);
});
