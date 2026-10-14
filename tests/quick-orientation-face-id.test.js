import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
import {QUICK_ORIENTATION_HAZARDS,QUICK_ORIENTATION_ACK,quickSafetyOrientationForm,quickSafetyAccountName,attachQuickHazardSelection,quickStickerVerificationMarkup} from '../src/quick-safety-orientation.js';

const tr=en=>en;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),ast=parseAst(source);
const fn=name=>{const node=ast.body.find(x=>x.type==='FunctionDeclaration'&&x.id.name===name);assert.ok(node,name);return source.slice(node.start,node.end)};

test('Quick Employee Face ID has a separate front camera and gallery, preserving four jobsite photos',()=>{
 const markup=quickSafetyOrientationForm({tr,esc,project:{name:'Jobsite'},profile:{}});
 assert.ok(markup.includes('Employee Face ID'));
 assert.ok(markup.includes('id="quick-face-camera"'));
 assert.ok(markup.includes('capture="user"'));
 assert.ok(markup.includes('id="quick-face-gallery"'));
 assert.ok(markup.includes('id="quick-face-preview"'));
 assert.ok(markup.includes('id="quick-photo-camera"'));
 assert.ok(markup.includes('id="quick-photo-gallery"'));
 assert.ok(markup.includes('id="quick-photo-preview"'));
 assert.ok(markup.includes('/ 4'));
});

test('verified Quick sticker renders the saved Face ID photo without deforming, and legacy records get a placeholder',()=>{
 const record={id:'quick-42',employee_name:'Worker',employee_trade:'Carpenter',sticker_number:'G-042',hazards:[]};
 const options={tr,esc,fmt:()=> 'today',projectName:'Project',facePhotoUrl:'https://images.example.test/face.jpg?x=1&y=2'};
 const withPhoto=quickStickerVerificationMarkup(record,options);
 assert.ok(withPhoto.includes('class="quick-sticker-face"'));
 assert.ok(withPhoto.includes('face.jpg?x=1&amp;y=2'));
 assert.ok(!withPhoto.includes('class="orientation-photo-empty"'));
 const legacy=quickStickerVerificationMarkup(record,{...options,facePhotoUrl:''});
 assert.ok(legacy.includes('class="orientation-photo-empty"'));
 assert.ok(!legacy.includes('class="quick-sticker-face"'));
});

test('new Quick Orientation saves a required employee face photo separately from jobsite photos',async()=>{
 const dom=new JSDOM('<main id="app"></main>'),doc=dom.window.document,uploads=[],writes=[],errors=[],urls=[];
 let serial=0;
 dom.window.URL.createObjectURL=()=> 'blob:face-'+(++serial);
 dom.window.URL.revokeObjectURL=url=>urls.push(url);
 const db={
  from(table){
   const q={
    select(){return q},eq(){return q},order(){return q},limit:async()=>({data:[],error:null}),
    insert(payload){writes.push({table,kind:'insert',payload});return q},
    update(payload){writes.push({table,kind:'update',payload});return q},
    single:async()=>({data:{id:'quick-123'},error:null})
   };return q;
  },
  storage:{from(bucket){return {upload:async(path,file)=>{uploads.push({bucket,path,file});return {error:null}},remove:async()=>({})}}}
 };
 const nav=[];
 const state={project:'project-1',profile:{id:'person-1',role:'safety',name:'Safety Representative',position:'Safety'},session:{user:{email:'safety@example.test'}},projects:[{id:'project-1',name:'Jobsite'}]};
 const context=vm.createContext({
  state,db,document:doc,FormData:dom.window.FormData,URL:dom.window.URL,crypto:{randomUUID:()=>String(++serial)},
  frame:html=>doc.querySelector('main').innerHTML=html,captureView:()=>()=>true,tr,esc,fmt:()=> 'today',
  quickSafetyOrientationForm,quickSafetyAccountName,attachQuickHazardSelection,QUICK_ORIENTATION_HAZARDS,QUICK_ORIENTATION_ACK,
  mountReportSignatures(){},reportApprovals:()=>({safety:{name:'Safety',strokes:[[1,2]]},employee:{name:'Worker',strokes:[[1,2]]}}),
  normalizeReportImage:async file=>file,clearDraft:async()=>{},savedAction(){},navigate:(...args)=>nav.push(args),error:e=>errors.push(e),console
 });
 vm.runInContext(fn('quickSafetyOrientation'),context);
 await context.quickSafetyOrientation();
 const form=doc.querySelector('#quick-orientation-form');
 assert.ok(form);
 for(const [key,value] of Object.entries({employee_name:'Worker',sticker_number:'AB-92',employee_trade:'Carpenter',employee_company:'G&E'}))form.elements[key].value=value;
 form.querySelector('[name="hazards"]').checked=true;
 form.querySelector('[name="acknowledged"]').checked=true;
 await form.onsubmit({preventDefault(){}});assert.equal(errors.length,1);assert.equal(writes.length,0);
 const faceInput=doc.querySelector('#quick-face-gallery');
 const faceFile=new dom.window.File(['photo'],'employee.jpg',{type:'image/jpeg'});
 Object.defineProperty(faceInput,'files',{configurable:true,value:[faceFile]});
 faceInput.onchange({target:faceInput});
 assert.ok(doc.querySelector('.quick-face-photo img'));
 const jobsiteInput=doc.querySelector('#quick-photo-gallery');
 Object.defineProperty(jobsiteInput,'files',{configurable:true,value:[new dom.window.File(['photo'],'site.jpg',{type:'image/jpeg'})]});
 jobsiteInput.onchange({target:jobsiteInput});
 assert.equal(doc.querySelectorAll('.quick-photo-preview img').length,1);
 await form.onsubmit({preventDefault(){}});
 assert.equal(errors.length,1);
 assert.equal(uploads.length,2);
 const faceUpload=uploads.find(x=>x.path.includes('/face-'));
 assert.ok(faceUpload);
 assert.ok(faceUpload.path.startsWith('project-1/person-1/quick-123/'));
 const final=writes.find(x=>x.kind==='update').payload;
 assert.equal(final.face_photo_path,faceUpload.path);
 assert.equal(final.photo_paths.length,1);
 assert.ok(!final.photo_paths.includes(faceUpload.path));
 assert.equal(final.status,'final');
 assert.equal(nav.at(-1)[0],'quickOrientationReport');
 assert.ok(urls.length>=2);
 dom.window.close();
});
