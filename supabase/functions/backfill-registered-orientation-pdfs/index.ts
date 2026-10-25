import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {createClient} from "npm:@supabase/supabase-js@2.117.2";
const env=(name:string)=>Deno.env.get(name)||"";
const admin=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const must=(q:any)=>{if(q.error)throw Error("Registered orientation archive database operation failed");return q.data};
const hazardLabels:Record<string,string>={"falls":"Falls / edges / floor openings","struck_by":"Struck-by / falling objects","caught_between":"Caught-in / between / pinch points","electrical":"Electrical / overhead lines","scaffolds":"Scaffolds / swing stages","ladders":"Ladders / stairways","cranes_rigging":"Cranes / rigging / suspended loads","excavations":"Excavations / trenches","silica_dust":"Silica / dust / respiratory exposure","noise":"Noise / hearing exposure","heat":"Heat / dehydration","chemicals":"Hazardous chemicals / SDS","confined_spaces":"Confined spaces / atmospheric hazards","housekeeping":"Housekeeping / slips / trips","fire_hot_work":"Fire / hot work","ppe_emergency":"Required PPE / emergency procedures"};
async function workerAuthorized(provided:string){
 if(!/^[a-f0-9]{64}$/.test(provided))return false;
 const row=must(await admin.from("dropbox_automatic_worker_key").select("secret").eq("id",1).single());
 const values=[provided,String(row.secret||"")],hashes=await Promise.all(values.map(x=>crypto.subtle.digest("SHA-256",new TextEncoder().encode(x))));
 let difference=0;const a=new Uint8Array(hashes[0]),b=new Uint8Array(hashes[1]);for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
 return difference===0;
}
const latin=(value:unknown)=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
 .replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,"-").replace(/[^\u0020-\u007e]/g," ").replace(/\s+/g," ").trim();
const truncated=(text:string,font:any,size:number,width:number)=>{
 let chars=latin(text);if(!chars)return "-";while(chars.length>1&&font.widthOfTextAtSize(chars,size)>width)chars=chars.slice(0,-1);
 return chars;
};
const ink=rgb(0.18,0.23,0.28),gray=rgb(0.42,0.47,0.50),paperGray=rgb(0.95,0.96,0.97);
function text(page:any,str:unknown,x:number,y:number,size:number,font:any,max=500,color=ink){
 page.drawText(truncated(String(str??""),font,size,max),{x,y,size,font,color});
}
async function getImage(bytes:Uint8Array,pdf:any){
 // Do not silently omit employee identity photos. Unsupported formats require manual attention.
 if(bytes[0]===0xff&&bytes[1]===0xd8)return pdf.embedJpg(bytes);
 if(bytes[0]===0x89&&bytes[1]===0x50)return pdf.embedPng(bytes);
 throw Error("Employee photo format cannot be included in the PDF");
}
function inside(image:any,x:number,y:number,w:number,h:number){
 const scale=Math.min(w/image.width,h/image.height),iw=image.width*scale,ih=image.height*scale;
 return {x:x+(w-iw)/2,y:y+(h-ih)/2,width:iw,height:ih};
}
function signature(page:any,approval:any,x:number,y:number,w:number,h:number){
 page.drawRectangle({x,y,width:w,height:h,borderWidth:0.7,borderColor:rgb(.75,.78,.80)});
 const strokes=Array.isArray(approval?.strokes)?approval.strokes:[];
 for(const segment of strokes.slice(0,180)){
  if(!Array.isArray(segment)||segment.length<2)continue;
  for(let i=1;i<Math.min(segment.length,200);i++){
   const first=segment[i-1],next=segment[i];
   if(![first?.[0],first?.[1],next?.[0],next?.[1]].every(z=>typeof z==='number'&&Number.isFinite(z)&&z>=0&&z<=1))continue;
   page.drawLine({start:{x:x+7+first[0]*(w-14),y:y+5+(1-first[1])*(h-10)},
    end:{x:x+7+next[0]*(w-14),y:y+5+(1-next[1])*(h-10)},thickness:1.3,color:ink});
  }
 }
}

async function createPdf(record:any,project:any){
 const pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const page=pdf.addPage([612,792]);
 page.drawRectangle({x:0,y:0,width:612,height:792,color:rgb(1,1,1)});
 page.drawRectangle({x:0,y:713,width:612,height:79,color:paperGray});
 try{
  const logo=await fetch("https://ge-safety-department.vercel.app/ge-logo.png");
  if(logo.ok){const image=await getImage(new Uint8Array(await logo.arrayBuffer()),pdf);page.drawImage(image,inside(image,35,728,72,48))}
 }catch{}
 text(page,"G&E FLORIDA CONTRACTORS",121,759,10,bold,430);
 text(page,"REGISTER SAFETY ORIENTATION",121,738,14,bold,448);
 const number="SO-"+latin(record.sticker_number).replace(/[^A-Za-z0-9_-]/g,"").toUpperCase();
 text(page,number,122,719,9,normal,465,gray);
 page.drawRectangle({x:36,y:696,width:540,height:1,color:gray});
 text(page,"EMPLOYEE INFORMATION",40,680,11,bold,490);
 const item=(label:string,value:unknown,x:number,y:number,width:number)=>{
  text(page,label.toUpperCase(),x,y,7.5,bold,width,gray);
  text(page,value||"Not recorded",x,y-15,9,normal,width);
 };
 item("Employee name",record.employee_name,42,654,235);
 item("Sticker number",record.sticker_number,295,654,235);
 item("Company",record.employee_company,42,620,235);
 item("Position / Trade",record.employee_position,295,620,235);
 item("Project",project.name,42,586,235);
 item("General contractor",project.general_contractor,295,586,235);
 item("Orientation date",record.orientation_date||record.created_at,42,552,235);
 // Every source registration has an ID photo; a missing photo must block automatic archival.
 const photoFile=record.orientation_photo_path;
 if(!photoFile)throw Error("Original employee identification photo missing.");
 const photo=await admin.storage.from("orientation-photos").download(photoFile);
 if(photo.error||!photo.data)throw Error("Employee identification image unavailable.");
 const img=await getImage(new Uint8Array(await photo.data.arrayBuffer()),pdf);
 page.drawRectangle({x:466,y:516,width:106,height:145,borderWidth:.8,borderColor:gray});
 page.drawImage(img,inside(img,472,522,94,133));
 text(page,"REGISTRATION EVIDENCE",40,491,10,bold,480);
 const labels=[["Sticker photo",record.sticker_photo_path],
  ["Orientation document",record.orientation_document_photo_path],
  ...((record.certificate_photo_paths||[]).map((path:string,i:number)=>["Certificate "+(i+1),path]))].filter(x=>x[1]);
 text(page,labels.length+" saved evidence attachments. See following pages.",40,470,8,normal,520);
 if(record.notes){
  text(page,"Orientation notes (full original notes included on a separate page)",40,451,8,normal,530);
 }
 page.drawRectangle({x:36,y:263,width:540,height:1,color:gray});
 text(page,"ORIGINAL RECORDED SIGNATURES",40,246,10,bold,500);
 text(page,"EMPLOYEE",44,220,8,bold,240,gray);
 text(page,"SAFETY REPRESENTATIVE",316,220,8,bold,255,gray);
 signature(page,record.approvals?.employee,42,150,248,60);
 signature(page,record.approvals?.safety,314,150,248,60);
 item("Employee signer",record.approvals?.employee?.name,45,136,230);
 item("Safety signer",record.approvals?.safety?.name,318,136,230);
 if(!record.approvals?.employee?.strokes?.length||!record.approvals?.safety?.strokes?.length)
  text(page,"One or more signatures were not recorded in this historical registration.",40,85,7,normal,520,gray);
 text(page,"G&E ONE - SAFETY DEPARTMENT | ARCHIVE OF SAVED REGISTRATION",40,53,8,bold,530,gray);
 // Evidence pages are generated dynamically; never place a placeholder in place of an existing image.
 for(let offset=0;offset<labels.length;offset+=4){
  const sheet=pdf.addPage([612,792]);
  sheet.drawRectangle({x:36,y:736,width:540,height:2,color:gray});
  text(sheet,"REGISTER SAFETY ORIENTATION - EVIDENCE",40,752,12,bold,530);
  text(sheet,number,40,720,8,normal,510,gray);
  for(const [index,entry] of labels.slice(offset,offset+4).entries()){
   const file=await admin.storage.from("orientation-photos").download(String(entry[1]));
   if(file.error||!file.data)throw Error("Required orientation evidence image unavailable.");
   const photo=await getImage(new Uint8Array(await file.data.arrayBuffer()),pdf);
   const x=40+(index%2)*270,y=372-Math.floor(index/2)*330;
   sheet.drawRectangle({x,y,width:255,height:300,borderColor:gray,borderWidth:.6});
   sheet.drawImage(photo,inside(photo,x+9,y+32,237,257));
   text(sheet,String(entry[0]),x+10,y+12,8,normal,232);
  }
 }
 if(record.notes){
  const notes=latin(record.notes),chunks=notes.match(/.{1,100}(?:\s|$)|\S.{0,99}/g)||[];
  for(let start=0;start<chunks.length;start+=48){
   const sheet=pdf.addPage([612,792]);
   text(sheet,"REGISTER SAFETY ORIENTATION - RECORDED NOTES",36,752,13,bold,540);
   text(sheet,number,36,729,8,normal,520);
   for(const [i,chunk] of chunks.slice(start,start+48).entries())text(sheet,chunk,40,697-i*13,8,normal,532);
  }
 }
 const bytes=new Uint8Array(await pdf.save());
 if(bytes.length<1024||new TextDecoder().decode(bytes.slice(0,8)).slice(0,5)!=="%PDF-")
  throw Error("Generated archive PDF failed validation.");
 return {bytes,number};
}
async function complete(row:any){
 const existing=must(await admin.from("report_documents")
  .select("id,version,pdf_path,document_status").eq("report_type","training")
  .eq("source_id",row.orientation_id).order("version",{ascending:false}).limit(10));
 const archived=existing.find((x:any)=>x.document_status==="final"&&x.pdf_path);
 if(archived)return archived.id;
 const record=must(await admin.from("safety_orientations").select("*")
  .eq("id",row.orientation_id).eq("project_id",row.project_id).single());
 const project=must(await admin.from("projects").select("name,general_contractor").eq("id",row.project_id).single());
 const {bytes,number}=await createPdf(record,project);
 const version=existing.reduce((n:number,x:any)=>Math.max(n,Number(x.version||0)),0)+1;
 const safe=number.replace(/[^A-Za-z0-9_-]/g,"");
 const path=row.project_id+"/training/"+safe+"-REGISTERED-"+row.orientation_id.slice(0,8)+"-REV-"+(version-1)+".pdf";
 const uploaded=await admin.storage.from("final-reports").upload(path,new Blob([bytes],{type:"application/pdf"}),
  {contentType:"application/pdf",cacheControl:"3600",upsert:false});
 if(uploaded.error)throw Error("Registered orientation PDF upload failed.");
 const result=await admin.from("report_documents").insert({
  project_id:row.project_id,report_type:"training",source_id:record.id,report_number:number,
  title:"Register Safety Orientation - "+record.employee_name,
  document_status:"final",version,
  snapshot:{source_page:"registeredOrientationReport",original_report_date:record.orientation_date||record.created_at,
   generated_at:new Date().toISOString(),backfill_from_saved_registration:true},
  pdf_path:path,created_by:record.created_by,finalized_by:record.created_by,finalized_at:new Date().toISOString()
 }).select("id").single();
 if(result.error){
  await admin.storage.from("final-reports").remove([path]);
  throw Error("Registered orientation archive metadata insert failed.");
 }
 await admin.from("report_document_events").insert({
  report_document_id:result.data.id,actor_id:record.created_by,event_type:"finalized",
  detail:{source_page:"registeredOrientationReport",backfill_from_saved_registration:true}
 });
 return result.data.id;
}
async function runWorker(){
 const jobs=must(await admin.rpc("claim_registered_orientation_pdf",{p_limit:2}));
 let completed=0,failed=0;
 for(const job of jobs){
  try{
   const documentId=await complete(job);
   const updated=await admin.from("registered_orientation_pdf_backfill").update({
    status:"completed",report_document_id:documentId,completed_at:new Date().toISOString(),
    lock_token:null,lock_until:null,last_error:null,updated_at:new Date().toISOString()
   }).eq("orientation_id",job.orientation_id).eq("lock_token",job.lock_token);
   if(updated.error)throw Error("Registered orientation backfill update failed.");
   completed++;
  }catch(error:any){
   const msg=String(error?.message||"Registered orientation PDF failed").slice(0,160);
   const wait=Math.min(86400,60*2**Math.min(Number(job.attempts||1),8));
   await admin.from("registered_orientation_pdf_backfill").update({
    status:"failed",last_error:msg,retry_after:new Date(Date.now()+wait*1000).toISOString(),
    lock_token:null,lock_until:null,updated_at:new Date().toISOString()
   }).eq("orientation_id",job.orientation_id).eq("lock_token",job.lock_token);
   failed++;
  }
 }
 return {completed,failed,claimed:jobs.length};
}
Deno.serve(async req=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  if(!await workerAuthorized(req.headers.get("x-ge-dropbox-worker")||""))return json({error:"Unauthorized"},401);
  const body=await req.json();
  if(body?.action!=="process")return json({error:"Invalid action"},400);
  return json(await runWorker());
 }catch{return json({error:"Registered orientation archive unavailable"},500)}
});
