import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {createClient} from "npm:@supabase/supabase-js@2.117.2";
const env=(name:string)=>Deno.env.get(name)||"";
const admin=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const must=(q:any)=>{if(q.error)throw Error("Final safety report archive database operation failed");return q.data};
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


const types:Record<string,{table:string,title:string,photos?:string,bucket?:string,owner?:string}>={
 daily_safety_walk:{table:"daily_safety_walks",title:"DAILY SAFETY WALK",photos:"daily_safety_walk_photos",bucket:"daily-safety-walks",owner:"item_id"},
 equipment_inspection:{table:"equipment_inspections",title:"EQUIPMENT INSPECTION",photos:"equipment_inspection_photos",bucket:"equipment-inspections",owner:"inspection_id"},
 incident:{table:"incident_reports",title:"INCIDENT / ACCIDENT REPORT",photos:"incident_report_photos",bucket:"incident-evidence",owner:"incident_id"},
 disciplinary_action:{table:"safety_discipline",title:"DISCIPLINARY ACTION",photos:"discipline_photos",bucket:"discipline-evidence",owner:"discipline_id"},
 correction:{table:"corrective_actions",title:"CORRECTIVE ACTION REPORT"}
};
const string=(value:any):string=>{
 if(value==null||value==="")return "Not recorded";
 if(typeof value==="object")return JSON.stringify(value,(key,v)=>key==="strokes"?"[Original signature strokes retained in GE ONE]":v);
 return String(value);
};
const split=(value:string,n=95)=>{
 const str=latin(value),lines:string[]=[];
 for(let i=0;i<str.length;i+=n)lines.push(str.slice(i,i+n));
 return lines.length?lines:["-"];
};
async function createPdf(record:any,projectName:string,kind:string,photos:any[]){
 const cfg=types[kind],pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const fresh=()=>{const page=pdf.addPage([612,792]);page.drawRectangle({x:36,y:739,width:540,height:1.5,color:gray});
  text(page,"G&E FLORIDA CONTRACTORS - SAFETY DEPARTMENT",40,754,10,bold,525);
  text(page,cfg.title,40,718,13,bold,525);return page;};
 let page=fresh(),cursor=687;
 const put=(str:string,size=8,font=normal)=>{
  for(const line of split(str)){
   if(cursor<58){page=fresh();cursor=680;}
   text(page,line,42,cursor,size,font,522);cursor-=size+5;
  }
 };
 put("Project: "+projectName,10,bold);put("Recorded: "+String(record.created_at||""),9);
 if(record.report_number)put("Report number: "+record.report_number,9);
 put("Source status: "+(record.status||record.overall_status||"Saved record"),9);
 cursor-=13;
 for(const [key,val] of Object.entries(record)){
  if(["approvals","id","project_id","created_by","updated_by","created_at","updated_at"].includes(key))continue;
  if(key==="observation_id")continue;
  put(key.replaceAll("_"," ").toUpperCase(),8,bold);
  for(const line of split(string(val)))put(" "+line,8);
  cursor-=4;
 }
 const approvals=record.approvals&&typeof record.approvals==="object"?Object.entries(record.approvals):[];
 if(approvals.length){
  put("RECORDED APPROVALS AND DIGITAL SIGNATURES",9,bold);
  for(const [role,value] of approvals){
   if(cursor<165){page=fresh();cursor=680;}
   const approval=value as any;
   put(role.replaceAll("_"," ")+": "+String(approval?.name||"Not recorded"),8,bold);
   if(Array.isArray(approval?.strokes)&&approval.strokes.length){
    signature(page,approval,44,cursor-53,240,45);cursor-=67;
   }else put("No original signature strokes saved.",7);
  }
 }
 for(let offset=0;offset<photos.length;offset+=4){
  const evidence=pdf.addPage([612,792]);text(evidence,cfg.title+" - ATTACHED PHOTOGRAPHS",39,753,12,bold,535);
  for(const [index,item] of photos.slice(offset,offset+4).entries()){
   const bucket=String(item.bucket||cfg.bucket||"");
   const file=await admin.storage.from(bucket).download(item.path);
   if(file.error||!file.data)throw Error("Saved report evidence photo unavailable. No incomplete PDF uploaded.");
   const image=await getImage(new Uint8Array(await file.data.arrayBuffer()),pdf);
   const x=38+(index%2)*270,y=400-Math.floor(index/2)*341;
   evidence.drawRectangle({x,y,width:254,height:302,borderColor:gray,borderWidth:.7});
   evidence.drawImage(image,inside(image,x+8,y+25,238,267));
   text(evidence,item.caption||item.kind||"Original report evidence",x+8,y+8,8,normal,240);
  }
 }
 const bytes=new Uint8Array(await pdf.save());
 if(bytes.length<600||new TextDecoder().decode(bytes.slice(0,8)).slice(0,5)!=="%PDF-")
  throw Error("Final source archive PDF integrity failed");
 return bytes;
}
async function complete(task:any){
 const cfg=types[task.source_type];if(!cfg)throw Error("Unsupported source report type");
 const prior=must(await admin.from("report_documents").select("id,pdf_path,version,document_status")
  .eq("report_type",task.source_type).eq("source_id",task.source_id)
  .order("version",{ascending:false}).limit(10));
 const saved=prior.find((x:any)=>x.document_status==="final"&&x.pdf_path);
 if(saved)return saved.id;
 const record=must(await admin.from(cfg.table).select("*").eq("id",task.source_id).single());
 const finished=task.source_type==="incident"||task.source_type==="equipment_inspection"
  ?record.status==="final"
  :task.source_type==="correction"?record.status==="closed":Boolean(record.approvals);
 if(!finished)throw Error("Source record is not finalized; original remains untouched");
 const project=must(await admin.from("projects").select("name").eq("id",task.project_id).single());
 let photos:any[]=[];
 if(task.source_type==="daily_safety_walk"){
  const items=must(await admin.from("daily_safety_walk_items").select("*").eq("walk_id",record.id));
  record.checklist_items=items;
  if(items.length){
   const pics=must(await admin.from("daily_safety_walk_photos").select("item_id,path,kind").in("item_id",items.map((x:any)=>x.id)));
   photos=pics.map((x:any)=>({...x,bucket:"daily-safety-walks"}));
  }
 }else if(cfg.photos&&cfg.owner){
  const pics=must(await admin.from(cfg.photos).select("path,caption").eq(cfg.owner,record.id));
  photos=pics.map((x:any)=>({...x,bucket:cfg.bucket}));
 }
 if(task.source_type==="correction"){
  const observation=must(await admin.from("observations").select("project_id,description,category,area").eq("id",record.observation_id).single());
  if(observation.project_id!==task.project_id)throw Error("Correction project does not match observation");
  record.original_observation=observation;
 }else if(record.project_id!==task.project_id)throw Error("Project does not match source");
 const bytes=await createPdf(record,project.name,task.source_type,photos);
 const version=prior.reduce((n:number,x:any)=>Math.max(n,Number(x.version||0)),0)+1;
 const number=record.report_number||task.source_type.toUpperCase().replaceAll("_","-")+"-"+task.source_id.slice(0,8).toUpperCase();
 const path=task.project_id+"/"+task.source_type+"/"+number+"-RECOVERED-"+task.source_id.slice(0,8)+"-REV-"+(version-1)+".pdf";
 const stored=await admin.storage.from("final-reports").upload(path,new Blob([bytes],{type:"application/pdf"}),
  {contentType:"application/pdf",cacheControl:"3600",upsert:false});
 if(stored.error)throw Error("Could not store reconstructed final PDF.");
 const original=record.incident_at||record.inspection_at||record.incident_date||record.created_at;
 const doc=await admin.from("report_documents").insert({
  project_id:task.project_id,report_type:task.source_type,source_id:task.source_id,report_number:number,
  title:cfg.title,document_status:"final",version,pdf_path:path,
  created_by:record.created_by,finalized_by:record.created_by,finalized_at:new Date().toISOString(),
  snapshot:{source_page:"recoveredSourceReport",original_report_date:original,
   generated_at:new Date().toISOString(),backfill_from_saved_record:true}
 }).select("id").single();
 if(doc.error){await admin.storage.from("final-reports").remove([path]);throw Error("Could not register recovered PDF");}
 await admin.from("report_document_events").insert({
  report_document_id:doc.data.id,actor_id:record.created_by,event_type:"finalized",
  detail:{source_page:"recoveredSourceReport",backfill_from_saved_record:true}
 });
 return doc.data.id;
}
async function runWorker(){
 const tasks=must(await admin.rpc("claim_final_source_pdf",{p_limit:2}));
 let completed=0,failed=0;
 for(const task of tasks){
  try{
   const id=await complete(task);
   const update=await admin.from("final_source_pdf_backfill").update({
    status:"completed",report_document_id:id,completed_at:new Date().toISOString(),
    lock_token:null,lock_until:null,last_error:null,updated_at:new Date().toISOString()
   }).eq("source_type",task.source_type).eq("source_id",task.source_id).eq("lock_token",task.lock_token);
   if(update.error)throw Error("Archive confirmation failed");completed++;
  }catch(error:any){
   const msg=String(error?.message||"Source PDF recovery failed").slice(0,160);
   await admin.from("final_source_pdf_backfill").update({
    status:"failed",last_error:msg,
    retry_after:new Date(Date.now()+Math.min(86400,60*2**Math.min(Number(task.attempts||1),9))*1000).toISOString(),
    lock_token:null,lock_until:null,updated_at:new Date().toISOString()
   }).eq("source_type",task.source_type).eq("source_id",task.source_id).eq("lock_token",task.lock_token);
   failed++;
  }
 }
 return {claimed:tasks.length,completed,failed};
}
Deno.serve(async req=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  if(!await workerAuthorized(req.headers.get("x-ge-dropbox-worker")||""))return json({error:"Unauthorized"},401);
  const input=await req.json();if(input.action!=="process")return json({error:"Unknown action"},400);
  return json(await runWorker());
 }catch{return json({error:"Completed source report PDF archiver temporarily unavailable"},500);}
});
