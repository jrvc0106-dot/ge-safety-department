import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quickStickerVerificationMarkup,quickStickerDuplicateMarkup} from '../src/quick-safety-orientation.js';

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
 assert.ok(html.includes('No jobsite photos'));
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
