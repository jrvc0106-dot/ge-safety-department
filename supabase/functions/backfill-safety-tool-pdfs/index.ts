import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {createClient} from "npm:@supabase/supabase-js@2.117.2";
const env=(name:string)=>Deno.env.get(name)||"";
const admin=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const must=(q:any)=>{if(q.error)throw Error("Safety tool archive database operation failed");return q.data};
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

const reportTypes:Record<string,string>={toolbox:"tool_toolbox",training:"tool_training",
 confined_space:"tool_qr",director:"tool_director",safety_net:"tool_safety_net"};
const typeTitles:Record<string,string>={toolbox:"TOOLBOX TALK",training:"G&E SAFETY TRAINING",
 confined_space:"CONFINED SPACE SAFETY REPORT",director:"SAFETY DIRECTOR REPORT",
 safety_net:"SAFETY NET INSPECTION"};
const friendly=(key:string)=>key.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
function detail(value:any):string{
 if(value==null||value==="")return "Not recorded";
 if(Array.isArray(value)){
  if(!value.length)return "None recorded";
  return value.map(x=>typeof x==="object"?JSON.stringify(x,(k,v)=>k==="strokes"?"[Digital signature strokes saved in GE ONE]":v):String(x)).join(" | ");
 }
 if(typeof value==="object")return JSON.stringify(value,(k,v)=>k==="strokes"?"[Digital signature strokes saved in GE ONE]":v);
 return String(value);
}
const chunks=(raw:string,n=92)=>{
 const str=latin(raw),result:string[]=[];
 for(let i=0;i<str.length;i+=n)result.push(str.slice(i,i+n));
 return result.length?result:["-"];
};
async function createPdf(record:any,project:string){
 const pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const title=typeTitles[record.kind]||"G&E SAFETY REPORT";
 const layout=()=>{const p=pdf.addPage([612,792]);p.drawRectangle({x:36,y:743,width:540,height:2,color:gray});
  text(p,"G&E FLORIDA CONTRACTORS - SAFETY DEPARTMENT",39,758,10,bold,525);
  text(p,title,39,723,13,bold,525);return p;};
 let page=layout(),cursor=688;
 const put=(value:string,size=8,font=normal)=>{
  for(const line of chunks(value,95)){
   if(cursor<69){page=layout();cursor=686;}
   text(page,line,44,cursor,size,font,515);
   cursor-=size+5;
  }
 };
 put("Jobsite: "+project,9,bold);
 put("Report number: "+record.report_number,9,bold);
 put("Created: "+new Date(record.created_at).toISOString(),9);
 cursor-=10;
 const values=record.payload||{};
 for(const [field,value] of Object.entries(values)){
  if(field==="approvals"||field==="signatures"||field==="attendance_signatures")continue;
  put(friendly(field)+": ",9,bold);
  for(const line of chunks(detail(value),95))put("  "+line,8);
  cursor-=4;
 }
 // Preserve named approvals and their original drawn signature strokes, when present.
 const signatureEntries=Object.entries(values.approvals||{})
  .filter((item):item is [string,any]=>Boolean(item[1]&&typeof item[1]==="object"));
 const attendeeList=Array.isArray(values.attendance_signatures)?values.attendance_signatures:[];
 for(const [role,approval] of [...signatureEntries,...attendeeList.map((a:any,i:number)=>["Attendee "+(i+1),a] as [string,any])]){
  if(cursor<190){page=layout();cursor=686;}
  put(friendly(role)+" signed by: "+String(approval?.name||"Not recorded"),8,bold);
  if(approval?.strokes?.length){signature(page,approval,45,cursor-51,240,47);cursor-=67;}
  else put("No digital signature strokes recorded",7);
 }
 const pictures=(Array.isArray(record.photos)?record.photos:[]).filter(x=>x&&typeof x.path==="string");
 for(let offset=0;offset<pictures.length;offset+=4){
  const photoPage=pdf.addPage([612,792]);
  text(photoPage,title+" - PHOTO EVIDENCE",38,756,13,bold,535);
  text(photoPage,record.report_number,38,735,8,normal,535);
  for(const [i,picture] of pictures.slice(offset,offset+4).entries()){
   const result=await admin.storage.from("safety-tool-evidence").download(picture.path);
   if(result.error||!result.data)throw Error("Saved tool report photo could not be loaded");
   const pictureBytes=new Uint8Array(await result.data.arrayBuffer());
   const image=await getImage(pictureBytes,pdf);
   const x=40+(i%2)*270,y=380-Math.floor(i/2)*336;
   photoPage.drawRectangle({x,y,width:255,height:307,borderWidth:.7,borderColor:gray});
   photoPage.drawImage(image,inside(image,x+7,y+28,241,272));
   text(photoPage,picture.label||"Safety evidence photo "+(offset+i+1),x+8,y+11,8,normal,237);
  }
 }
 const bytes=new Uint8Array(await pdf.save());
 if(bytes.length<500||new TextDecoder().decode(bytes.slice(0,8)).slice(0,5)!=="%PDF-")
  throw Error("Invalid final archive PDF");
 return bytes;
}
async function complete(row:any){
 const record=must(await admin.from("safety_tool_records").select("*").eq("id",row.tool_id).eq("project_id",row.project_id).single());
 const reportType=reportTypes[record.kind];if(!reportType)throw Error("Tool type is not a finalized safety report");
 const prior=must(await admin.from("report_documents").select("id,version,pdf_path,document_status")
  .eq("report_type",reportType).eq("source_id",row.tool_id).order("version",{ascending:false}).limit(10));
 const existing=prior.find((x:any)=>x.document_status==="final"&&x.pdf_path);
 if(existing)return existing.id;
 const project=must(await admin.from("projects").select("name").eq("id",row.project_id).single());
 const pdf=await createPdf(record,project.name);
 const next=prior.reduce((n:number,x:any)=>Math.max(n,Number(x.version||0)),0)+1;
 const path=row.project_id+"/"+reportType+"/"+record.report_number+"-BACKFILL-"+row.tool_id.slice(0,8)+"-REV-"+(next-1)+".pdf";
 const uploaded=await admin.storage.from("final-reports").upload(path,new Blob([pdf],{type:"application/pdf"}),
  {contentType:"application/pdf",upsert:false,cacheControl:"3600"});
 if(uploaded.error)throw Error("Final safety report PDF could not be saved");
 const date=record.payload?.training_date||record.payload?.entry_date||record.created_at;
 const result=await admin.from("report_documents").insert({
  project_id:row.project_id,report_type:reportType,source_id:row.tool_id,report_number:record.report_number,
  title:(typeTitles[record.kind]||"Safety Report")+" - "+record.report_number,
  document_status:"final",version:next,pdf_path:path,created_by:record.created_by,
  finalized_by:record.created_by,finalized_at:new Date().toISOString(),
  snapshot:{source_page:"safetyToolReport",original_report_date:date,generated_at:new Date().toISOString(),
   backfill_from_saved_tool:true,kind:record.kind}
 }).select("id").single();
 if(result.error){await admin.storage.from("final-reports").remove([path]);throw Error("Tool report PDF registration failed");}
 await admin.from("report_document_events").insert({
  report_document_id:result.data.id,actor_id:record.created_by,event_type:"finalized",
  detail:{source_page:"safetyToolReport",backfill_from_saved_tool:true}
 });
 return result.data.id;
}
async function runWorker(){
 const tasks=must(await admin.rpc("claim_safety_tool_pdf",{p_limit:2}));
 let completed=0,failed=0;
 for(const task of tasks){
  try{
   const id=await complete(task);
   const saved=await admin.from("safety_tool_pdf_backfill").update({
    status:"completed",report_document_id:id,completed_at:new Date().toISOString(),
    lock_until:null,lock_token:null,last_error:null,updated_at:new Date().toISOString()
   }).eq("tool_id",task.tool_id).eq("lock_token",task.lock_token);
   if(saved.error)throw Error("Unable to confirm archived safety tool report");
   completed++;
  }catch(error:any){
   const message=String(error?.message||"PDF archive failed").slice(0,160),wait=Math.min(86400,60*2**Math.min(Number(task.attempts||1),8));
   await admin.from("safety_tool_pdf_backfill").update({
    status:"failed",last_error:message,retry_after:new Date(Date.now()+wait*1000).toISOString(),
    lock_until:null,lock_token:null,updated_at:new Date().toISOString()
   }).eq("tool_id",task.tool_id).eq("lock_token",task.lock_token);
   failed++;
  }
 }
 return {claimed:tasks.length,completed,failed};
}
Deno.serve(async req=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  if(!await workerAuthorized(req.headers.get("x-ge-dropbox-worker")||""))return json({error:"Unauthorized"},401);
  const input=await req.json();
  if(input.action!=="process")return json({error:"Unknown action"},400);
  return json(await runWorker());
 }catch{return json({error:"Safety report archiver temporarily unavailable"},500);}
});
