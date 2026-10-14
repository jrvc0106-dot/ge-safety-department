import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quickStickerVerificationMarkup,quickStickerDuplicateMarkup,quickOrientationPrimaryPhotoPath} from '../src/quick-safety-orientation.js';

const tr=(en)=>en;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=()=> 'Oct 13, 2026';
const record={id:'quick-1',sticker_number:'G-007',employee_name:'Ana <Lopez>',employee_trade:'Carpenter',employee_company:'G&E',employee_phone:'305-555-0101',emergency_contact:'Jose & Maria',orientation_at:'2026-10-13T14:00:00Z',hazards:[{key:'falls'}],photo_paths:['path1']};

test('team field quick sticker verification includes saved employee information and a report link',()=>{
 const html=quickStickerVerificationMarkup(record,{tr,esc,fmt,projectName:'Rivage',photos:['https://example.test/photo.jpg'],signatures:'APPROVAL SIGNATURES'});
 for(const value of ['QUICK SAFETY ORIENTATION VERIFIED','G-007','Ana &lt;Lopez&gt;','Rivage','305-555-0101','Jose &amp; Maria','Falls / edges','APPROVAL SIGNATURES','data-quick-verify-report="quick-1"'])assert.ok(html.includes(value),value);
 assert.ok(html.includes('photo.jpg'));
 assert.ok(!html.includes('Ana <Lopez>'));
 assert.ok(html.includes('not verified face ID'));
});
test('quick sticker view does not invent absent evidence or unrelated hazards',()=>{
 const html=quickStickerVerificationMarkup({...record,emergency_contact:null,hazards:[],photo_paths:[]},{tr,esc,fmt,photos:[]});
 assert.ok(!html.includes('Jobsite Photos'));
 assert.ok(!html.includes('QUICK ORIENTATION EVIDENCE'));
 assert.ok(!html.includes('orientation-evidence-grid'));
 assert.ok(html.includes('No hazard selections'));
 assert.ok(!html.includes('Scaffolds / swing stages'));
});
test('duplicate quick stickers require choosing a specific report and do not claim one verified employee',()=>{
 const html=quickStickerDuplicateMarkup([record,{...record,id:'quick-2',employee_name:'Other Person'}],{tr,esc,fmt});
 assert.ok(html.includes('More than one Quick Orientation'));
 assert.ok(html.includes('data-quick-verify-report="quick-1"'));
 assert.ok(html.includes('data-quick-verify-report="quick-2"'));
 assert.ok(!html.includes('ORIENTATION VERIFIED'));
});
test('lookup searches both registries without changing the legacy evidence flow',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.ok(source.includes("db.from('quick_safety_orientations').select('*').eq('sticker_number',number).eq('project_id',teamProjectId).eq('status','final')"));
 assert.ok(source.includes("db.from('safety_orientations').select('*,employee_profile:profiles!safety_orientations_employee_profile_id_fkey"));
 assert.ok(source.includes('bindQuickReports()'));
 assert.ok(source.includes("db.from('safety_orientation_events').insert"));
 assert.ok(source.includes("db.from('quick_safety_orientations').select('id').eq('project_id',projectId).eq('sticker_number',sticker).eq('status','final')"));
 assert.ok(source.includes("db.from('safety_orientations').select('id').eq('project_id',projectId).eq('sticker_number',sticker)"));
});

test('first Quick Orientation photo is always the sticker profile picture for historical records',()=>{
 const old={sticker_number:'0585',photo_paths:['project/user/record/1-face.jpg','project/user/record/2-sticker.jpg'],face_photo_path:null};
 assert.equal(quickOrientationPrimaryPhotoPath(old),'project/user/record/1-face.jpg');
 // Even an additional face image cannot replace the first photo already recorded.
 assert.equal(quickOrientationPrimaryPhotoPath({...old,face_photo_path:'project/user/record/newer-face.jpg'}),'project/user/record/1-face.jpg');
 const selected=quickOrientationPrimaryPhotoPath(old),photoUrls=['https://test.invalid/first-face.jpg','https://test.invalid/second-sticker.jpg'];
 const html=quickStickerVerificationMarkup({...record,sticker_number:'0585'},{tr,esc,fmt,photos:photoUrls,facePhotoUrl:photoUrls[old.photo_paths.indexOf(selected)]});
 assert.ok(html.includes('class="quick-sticker-face" src="https://test.invalid/first-face.jpg"'));
 assert.ok(!html.includes('class="orientation-photo-empty"'));
});
test('new Quick Orientation continues to use the independent Employee Face ID',()=>{
 assert.equal(quickOrientationPrimaryPhotoPath({photo_paths:[],face_photo_path:'project/user/record/face-id.jpg'}),'project/user/record/face-id.jpg');
 assert.equal(quickOrientationPrimaryPhotoPath({photo_paths:[],face_photo_path:null}),'');
 assert.equal(quickOrientationPrimaryPhotoPath(null),'');
});
test('Team Field sticker verification uses the first recorded image rather than later uploads',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.ok(source.includes('const primaryPhotoPath=quickOrientationPrimaryPhotoPath(record)'));
 assert.ok(source.includes('primaryPhotoPath===firstStoredPhoto?photoUrls[0]'));
 assert.ok(source.includes('quickStickerVerificationMarkup(record,{tr,esc,fmt,projectName:project.name,photos:photoUrls,facePhotoUrl,signatures})'));
});
