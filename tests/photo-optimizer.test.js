import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPhotoOptimizer,photoDimensions} from '../src/photo-optimizer.js';
import {createPdfLoader} from '../src/pdf-loader.js';
const photo={size:5*1024*1024,type:'image/jpeg',name:'site.jpg',lastModified:123};
function setup({size=500000,fail=false}={}){
 let decoded=0,closed=0;const surfaces=[],draws=[];
 const optimize=createPhotoOptimizer({decode:async()=>{decoded++;return {width:4032,height:3024,close(){closed++}}},canvas:()=>{const surface={getContext:()=>({drawImage(...args){draws.push(args)}}),toBlob(callback,type,quality){assert.equal(quality,.94);if(fail)throw Error('Encoder unavailable');callback(new Blob([new Uint8Array(size)],{type}))}};surfaces.push(surface);return surface},makeFile:(blob,file)=>({size:blob.size,type:blob.type,name:file.name,lastModified:file.lastModified})});
 return {optimize,surfaces,draws,decoded:()=>decoded,closed:()=>closed};
}
test('large photos become smaller while keeping filename, type, proportion and releasing memory',async()=>{
 const t=setup(),result=await t.optimize(photo);assert.equal(result.size,500000);assert.equal(result.name,photo.name);assert.equal(result.lastModified,123);assert.equal(result.type,photo.type);
 const [,x,y,width,height]=t.draws[0];assert.equal(x,0);assert.equal(y,0);assert.ok(width<=3072&&height<=3072&&width*height<=6000000);assert.ok(Math.abs(width/height-4/3)<.002);assert.equal(t.closed(),1);assert.equal(t.surfaces[0].width,0);assert.equal(t.surfaces[0].height,0);
});
test('simultaneous requests for a photo encode once and optimized results are reused',async()=>{
 const t=setup({size:1500000});const [a,b]=await Promise.all([t.optimize(photo),t.optimize(photo)]);assert.equal(a,b);assert.equal(await t.optimize(a),a);assert.equal(t.decoded(),1);
});
test('small, transparent and document image formats remain untouched',async()=>{
 const t=setup();for(const file of [{...photo,size:300000},{...photo,type:'image/png'},{...photo,type:'image/gif'}])assert.equal(await t.optimize(file),file);assert.equal(t.decoded(),0);
});
for(const options of [{size:photo.size},{size:0},{fail:true}])test(`failed or unhelpful encoding retains the original photo (${JSON.stringify(options)})`,async()=>{
 const t=setup(options);assert.equal(await t.optimize(photo),photo);assert.equal(t.closed(),1);assert.equal(t.surfaces[0].width,0);
});
test('photo bounds support portrait, landscape and panoramic photos without distortion',()=>{
 for(const [w,h] of [[12000,9000],[9000,12000],[16000,1000],[1200,800]]){const d=photoDimensions(w,h);assert.ok(d.width<=3072&&d.height<=3072&&d.width*d.height<=6000000);assert.ok(d.width<=w&&d.height<=h);assert.ok(Math.abs(d.width/d.height-w/h)<.03)}
});
test('PDF tools load once on demand; a failed download can be retried',async()=>{
 let attempts=0;const module={html2pdf(){},renderPaginatedPdf(){}};const load=createPdfLoader(async()=>{attempts++;if(attempts===1)throw Error('Offline');return module});assert.equal(attempts,0);await assert.rejects(load(),/Offline/);const [a,b]=await Promise.all([load(),load()]);assert.equal(a,module);assert.equal(a,b);assert.equal(await load(),module);assert.equal(attempts,2);
});
