import test from 'node:test';
import assert from 'node:assert/strict';
import {jhaScaledSize,optimizeJhaPhoto,jhaPhotoSize} from '../src/jha-photo-size.js';

test('JHA resizes landscape, portrait and square images proportionally without cropping',()=>{
 assert.deepEqual(jhaScaledSize(4032,3024),{width:1920,height:1440});
 assert.deepEqual(jhaScaledSize(3024,4032),{width:1440,height:1920});
 assert.deepEqual(jhaScaledSize(4000,4000),{width:1920,height:1920});
 assert.deepEqual(jhaScaledSize(1200,900),{width:1200,height:900});
});
test('JHA optimizer leaves non-JPEG files and small images untouched',async()=>{
 const png={type:'image/png',size:3000000};
 const small={type:'image/jpeg',size:jhaPhotoSize.minBytes-1};
 assert.equal(await optimizeJhaPhoto(png),png);
 assert.equal(await optimizeJhaPhoto(small),small);
});
