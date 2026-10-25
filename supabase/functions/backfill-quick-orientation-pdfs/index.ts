import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {createClient} from "npm:@supabase/supabase-js@2.117.2";
const env=(name:string)=>Deno.env.get(name)||"";
const admin=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const must=(q:any)=>{if(q.error)throw Error("Quick orientation archive database operation failed");return q.data};
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
async function createPdf(record:any,project:string){
 const pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const page=pdf.addPage([612,792]),W=612,black=ink;
 page.drawRectangle({x:0,y:0,width:612,height:792,color:rgb(1,1,1)});
 page.drawRectangle({x:0,y:713,width:612,height:79,color:paperGray});
 // Use the same GE logo file as existing reports. Keep proportions; missing image is non-fatal.
 try{
  const response=await fetch("https://ge-safety-department.vercel.app/ge-logo.png");
  if(response.ok){
   const bytes=new Uint8Array(await response.arrayBuffer());
   const image=await getImage(bytes,pdf);
   page.drawImage(image,inside(image,34,728,72,49));
  }
 }catch{}
 text(page,"G&E FLORIDA CONTRACTORS",122,758,10,bold,370);
 text(page,"QUICK SAFETY ORIENTATION",122,739,15,bold,445);
 const stamp=new Date(record.orientation_at||record.created_at);
 const shortDate=Number.isFinite(stamp.getTime())?stamp.toISOString().slice(0,10).replaceAll("-",""):"00000000";
 const number="QSO-"+shortDate+"-"+String(record.id).slice(0,6).toUpperCase();
 text(page,number,122,722,9,normal,375,gray);
 page.drawRectangle({x:36,y:698,width:540,height:2,color:ink});
 text(page,"EMPLOYEE & JOBSITE INFORMATION",40,683,10,bold,490);
 const field=(label:string,value:unknown,x:number,y:number,width:number)=>{
  text(page,label.toUpperCase(),x,y,7.1,bold,width,gray);
  text(page,value||"-",x,y-14,9,normal,width);
 };
 field("Employee name",record.employee_name,42,665,202);
 field("Sticker number",record.sticker_number,274,665,184);
 field("Position / Trade",record.employee_trade,42,630,202);
 field("Employer",record.employee_company,274,630,184);
 field("Project / Jobsite",project,42,595,202);
 const at=new Date(record.orientation_at||record.created_at);
 field("Orientation date",Number.isFinite(at.getTime())?at.toLocaleDateString("en-US",{timeZone:"America/New_York"}):"-",274,595,184);
 if(record.emergency_contact)field("Emergency contact",record.emergency_contact,42,559,420);
 if(record.employee_phone)field("Employee phone",record.employee_phone,274,559,180);
 const path=record.face_photo_path||(Array.isArray(record.photo_paths)?record.photo_paths[0]:"");
 if(!path)throw Error("Employee identification photo is missing");
 const photo=await admin.storage.from("quick-orientation-photos").download(path);
 if(photo.error||!photo.data)throw Error("Saved employee identification photo cannot be loaded");
 const face=await getImage(new Uint8Array(await photo.data.arrayBuffer()),pdf);
 page.drawRectangle({x:470,y:578,width:98,height:108,borderWidth:1,borderColor:rgb(.72,.76,.78)});
 page.drawImage(face,inside(face,474,582,90,100));
 page.drawRectangle({x:36,y:533,width:540,height:1,color:rgb(.77,.79,.81)});
 text(page,"JOBSITE HAZARDS & SAFETY CONTROLS",40,516,10,bold,490);
 const keys=(Array.isArray(record.hazards)?record.hazards:[]).map((h:any)=>h?.key).filter((key:string)=>typeof key==="string");
 if(keys.length>16)throw Error("Orientation contains more hazards than single-page template supports");
 for(let i=0;i<keys.length;i++){
  const col=Math.floor(i/8),position=i%8,x=col?314:42,y=494-position*32.4;
  const label=hazardLabels[keys[i]]||keys[i].replaceAll("_"," ");
  page.drawRectangle({x,y:y+1,width:8,height:8,borderWidth:.7,borderColor:gray,color:paperGray});
  text(page,"x",x+2,y+1,7,bold,8,gray);
  text(page,label,x+13,y+1,8.1,bold,230);
 }
 page.drawRectangle({x:36,y:231,width:540,height:1,color:rgb(.77,.79,.81)});
 text(page,"ACKNOWLEDGMENT",40,215,9,bold,490);
 text(page,record.acknowledged?"Safety orientation completed and acknowledged by the employee.":"No signed acknowledgement recorded.",40,201,7.4,normal,515);
 text(page,"EMPLOYEE SIGNATURE",44,184,7.6,bold,240,gray);
 text(page,"SAFETY REPRESENTATIVE SIGNATURE",316,184,7.6,bold,255,gray);
 signature(page,record.approvals?.employee,42,120,248,56);
 signature(page,record.approvals?.safety,314,120,248,56);
 text(page,record.approvals?.employee?.name||record.employee_name,46,108,8,bold,235);
 text(page,record.approvals?.safety?.name||"-",318,108,8,bold,235);
 page.drawRectangle({x:36,y:78,width:540,height:1,color:rgb(.77,.79,.81)});
 text(page,"G&E ONE - SAFETY DEPARTMENT | FINAL EMPLOYEE ORIENTATION RECORD",38,61,7,normal,515,gray);
 text(page,"Original record retained in GE ONE. Archive copy generated from stored evidence.",38,47,6.8,normal,515,gray);
 // Additional evidence photos, when present, are retained on their own attachment page.
 const extra=Array.isArray(record.photo_paths)?record.photo_paths.filter((p:string)=>p!==path):[];
 if(extra.length){
  const evidencePage=pdf.addPage([W,792]);text(evidencePage,"QUICK ORIENTATION - PHOTO EVIDENCE",36,753,14,bold,540);
  text(evidencePage,number,36,734,8,normal,540,gray);
  for(let i=0;i<Math.min(extra.length,4);i++){
   const response=await admin.storage.from("quick-orientation-photos").download(extra[i]);
   if(response.error||!response.data)throw Error("Saved orientation evidence photo could not be loaded");
   const photo=await getImage(new Uint8Array(await response.data.arrayBuffer()),pdf);
   const x=36+(i%2)*275,y=396-Math.floor(i/2)*327;
   evidencePage.drawRectangle({x,y,width:260,height:305,borderColor:rgb(.76,.79,.8),borderWidth:.6});
   evidencePage.drawImage(photo,inside(photo,x+8,y+28,244,268));
   text(evidencePage,"Orientation evidence photo "+(i+1),x+8,y+10,8,normal,244);
  }
 }
 return {bytes:new Uint8Array(await pdf.save()),number};
}
async function complete(row:any){
 const existing=must(await admin.from("report_documents")
  .select("id,version,pdf_path,document_status").eq("report_type","training").eq("source_id",row.orientation_id)
  .order("version",{ascending:false}).limit(10));
 const archived=existing.find((x:any)=>x.document_status==="final"&&x.pdf_path);
 if(archived)return archived.id;
 const record=must(await admin.from("quick_safety_orientations").select("*").eq("id",row.orientation_id).eq("project_id",row.project_id).eq("status","final").single());
 const project=must(await admin.from("projects").select("name").eq("id",row.project_id).single());
 const {bytes,number}=await createPdf(record,project.name);
 if(bytes.length<400||new TextDecoder().decode(bytes.slice(0,8)).slice(0,5)!=="%PDF-")
  throw Error("Generated PDF integrity validation failed");
 const version=existing.reduce((n:number,x:any)=>Math.max(n,Number(x.version||0)),0)+1;
 const path=row.project_id+"/training/"+number+"-BACKFILL-"+row.orientation_id.slice(0,8)+"-REV-"+(version-1)+".pdf";
 const blob=new Blob([bytes],{type:"application/pdf"});
 const uploaded=await admin.storage.from("final-reports").upload(path,blob,{contentType:"application/pdf",cacheControl:"3600",upsert:false});
 if(uploaded.error)throw Error("Final PDF could not be archived in GE ONE");
 const inserted=await admin.from("report_documents").insert({
  project_id:row.project_id,report_type:"training",source_id:record.id,report_number:number,
  title:"Quick Safety Orientation - "+record.employee_name,
  document_status:"final",version,
  snapshot:{source_page:"quickOrientationReport",original_report_date:record.orientation_at||record.created_at,
   generated_at:new Date().toISOString(),backfill_from_saved_registration:true},
  pdf_path:path,created_by:record.created_by,finalized_by:record.created_by,finalized_at:new Date().toISOString()
 }).select("id").single();
 if(inserted.error){
  await admin.storage.from("final-reports").remove([path]);
  throw Error("Final archive record could not be registered");
 }
 await admin.from("report_document_events").insert({report_document_id:inserted.data.id,actor_id:record.created_by,
  event_type:"finalized",detail:{source_page:"quickOrientationReport",backfill_from_saved_registration:true}});
 return inserted.data.id;
}
async function runWorker(){
 const jobs=must(await admin.rpc("claim_quick_orientation_pdf_backfill",{p_limit:3}));
 let completed=0,failed=0;
 for(const job of jobs){
  try{
   const documentId=await complete(job);
   const updated=await admin.from("quick_orientation_pdf_backfill").update({
    status:"completed",report_document_id:documentId,completed_at:new Date().toISOString(),
    lock_token:null,lock_until:null,last_error:null,updated_at:new Date().toISOString()
   }).eq("orientation_id",job.orientation_id).eq("lock_token",job.lock_token);
   if(updated.error)throw Error("Archive backfill confirmation failed");
   completed++;
  }catch(error:any){
   const msg=String(error?.message||"Could not create quick orientation PDF").slice(0,160);
   const wait=Math.min(24*3600,60*2**Math.min(Number(job.attempts||1),8));
   await admin.from("quick_orientation_pdf_backfill").update({
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
 }catch{return json({error:"Quick orientation PDF archiver is temporarily unavailable"},500)}
});
