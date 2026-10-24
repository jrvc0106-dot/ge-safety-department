import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {File} from 'node:buffer';
import {nativeJhaHeicToJpeg,normalizeJhaPhoto} from '../src/jha-image-recovery.js';

test('JHA iPad HEIC image uses native JPEG recovery if the external converter is unavailable',async()=>{
 const original=new File(['heic-data'],'IMG_1002.HEIC',{type:'image/heic'});
 const converted=new File(['jpeg'],'IMG_1002.jpg',{type:'image/jpeg'});
 const output=await normalizeJhaPhoto(original,{
  normalize:async()=>{throw Error('Failed to load converter')},
  fallback:async file=>{assert.equal(file,original);return converted}
 });
 assert.equal(output.name,'IMG_1002.jpg');
 assert.equal(output.type,'image/jpeg');
});

test('non-HEIC image errors do not silently produce a broken photo',async()=>{
 const original=new File(['bad'],'IMG_1002.png',{type:'image/png'});
 let fallbackCalls=0;
 await assert.rejects(normalizeJhaPhoto(original,{
  normalize:async()=>{throw Error('Unsupported image')},
  fallback:async()=>{fallbackCalls++;return original}
 }),/Unsupported image/);
 assert.equal(fallbackCalls,0);
});

test('native iPad HEIC JPEG encoding preserves aspect ratio and frees temporary surfaces',async()=>{
 const photo=new File(['heic-data'],'IMG_2456.heic',{type:'image/heic'});
 let closed=0,freed=0;
 const pixels={width:4000,height:2000,close(){closed++}};
 const surface={
  width:0,height:0,
  getContext(){return{drawImage(img,x,y,w,h){assert.equal(img,pixels);assert.equal(w,3072);assert.equal(h,1536)}}},
  toBlob(cb,type){assert.equal(type,'image/jpeg');cb(new Blob(['JPEG-DATA'],{type}))}
 };
 const env={createImageBitmap:async()=>pixels,document:{createElement:tag=>{assert.equal(tag,'canvas');return surface}},File};
 const saved=await nativeJhaHeicToJpeg(photo,{env});
 assert.equal(saved.name,'IMG_2456.jpg');
 assert.equal(saved.type,'image/jpeg');
 assert.equal(closed,1);
 assert.equal(surface.width,0);assert.equal(surface.height,0);
});

test('Miramar Create Daily Report picker accepts native iPad photos and JHA checks size after optimization',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/accept="image\/\*,\.heic,\.heif" multiple/);
 assert.match(main,/type==='daily_safety_walk'\?await normalizeJhaPhoto\(original/);
 assert.match(main,/type==='daily_safety_walk'&&file\.size>10\*1024\*1024/);
 assert.match(main,/for\(const file of walkPhotoSets\[i\]\)\{const normalized=await normalizeJhaPhoto/);
 assert.match(main,/skipBlankLeadingPage:true/);
});
