import {createClient} from "npm:@supabase/supabase-js@2.117.2";

const env=(name:string)=>Deno.env.get(name)||"";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}
});
const admin=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
const must=(r:any)=>{if(r.error)throw Error("Automatic Dropbox storage is unavailable.");return r.data};
const hex=(bytes:Uint8Array)=>Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
async function authorizeWorker(provided:string){
 if(!provided||!/^[a-f0-9]{64}$/.test(provided))return false;
 const item=must(await admin.from("dropbox_automatic_worker_key").select("secret").eq("id",1).single());
 const both=[provided,String(item.secret||"")];
 const hashed=await Promise.all(both.map(s=>crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))));
 const a=new Uint8Array(hashed[0]),b=new Uint8Array(hashed[1]);
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
async function cryptKey(){
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env("SUPABASE_SERVICE_ROLE_KEY")));
 return crypto.subtle.importKey("raw",hash,"AES-GCM",false,["decrypt"]);
}
async function decryptedToken(value:string){
 const [iv,cipher]=String(value).split(".");
 const fromHex=(s:string)=>new Uint8Array((s.match(/../g)||[]).map(x=>parseInt(x,16)));
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:fromHex(iv)},
  await cryptKey(),fromHex(cipher)));
}
async function providerCall(url:string,options:RequestInit){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch(url,{...options,signal:controller.signal});
  const result=await response.text();
  let body:any={};try{body=result?JSON.parse(result):{}}catch{}
  if(!response.ok){
   const endpoint=new URL(url).pathname;
   const scope=result.match(/(?:required|requires|missing|require[d]?)\s+(?:the\s+)?scope\s+['"\x60]?([a-z][a-z0-9._-]+)/i);
   const raw=String(body?.error_summary||body?.error_description||(typeof body?.error==="string"?body.error:"")||result);
   const detail=scope?"Dropbox permission "+scope[1]+" missing; enable it, Submit and reconnect":raw
     .replace(/Bearer\s+[A-Za-z0-9_.~-]+/gi,"Bearer hidden")
     .replace(/\b(?:sl\.|scl\.)[A-Za-z0-9_.~-]+/gi,"hidden")
     .replace(/[^A-Za-z0-9_.\/\-: '()]/g," ").replace(/\s+/g," ").trim().slice(0,128);
   const error=new Error("Dropbox HTTP "+response.status+" at "+endpoint+(detail?": "+detail:""));
   (error as any).status=response.status;
   (error as any).tag=String(body?.error_summary||"");
   throw error;
  }
  return body;
 }finally{clearTimeout(timer);}
}
const jsonHeaders=(token:string)=>({Authorization:"Bearer "+token,"Content-Type":"application/json"});
async function accessToken(connection:any){
 const appKey=String(connection.app_key||env("DROPBOX_BACKUP_APP_KEY")||"");
 if(!appKey)throw Error("Dropbox must be reconnected to refresh its access.");
 const clientSecret=connection.app_key?"":env("DROPBOX_BACKUP_APP_SECRET");
 const payload=new URLSearchParams({
  grant_type:"refresh_token",refresh_token:await decryptedToken(connection.encrypted_token),
  client_id:appKey,...(clientSecret?{client_secret:clientSecret}:{})
 });
 const response=await providerCall("https://api.dropboxapi.com/oauth2/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:payload
 });
 if(!response.access_token)throw Error("Dropbox authorization has expired; reconnect account.");
 return String(response.access_token);
}
async function ensureFolder(token:string,path:string){
 try{
  await providerCall("https://api.dropboxapi.com/2/files/create_folder_v2",{
   method:"POST",headers:jsonHeaders(token),body:JSON.stringify({path,autorename:false})
  });
 }catch(error:any){
  // Existing folders are expected after the first PDF. Reject file-vs-folder conflicts.
  if(error.status===409&&/path\/conflict\/folder/.test(error.tag))return;
  if(error.status===409&&/path\/conflict/.test(error.tag)){
   const info=await providerCall("https://api.dropboxapi.com/2/files/get_metadata",{
    method:"POST",headers:jsonHeaders(token),body:JSON.stringify({path})
   });
   if(info[".tag"]==="folder")return;
  }
  throw error;
 }
}
const safe=(value:unknown,fallback:string)=>String(value||fallback).normalize("NFKD")
 .replace(/[\u0300-\u036f]/g,"").replace(/[\\/:*?"<>|\u0000-\u001f]+/g," ")
 .replace(/[^A-Za-z0-9._ -]/g," ").replace(/\s+/g," ").trim().slice(0,92)||fallback;
const dateLabel=(value:unknown)=>{
 const date=new Date(String(value||""));
 if(!Number.isFinite(date.getTime()))return "Unknown-Date";
 return [String(date.getUTCMonth()+1).padStart(2,"0"),
  String(date.getUTCDate()).padStart(2,"0"),date.getUTCFullYear()].join(".");
};
const reportCategories:Record<string,string>={
 daily_report:"Daily Safety Reports",daily_safety_walk:"Daily Safety Walks",
 observation:"Safety Observations",correction:"Corrective Actions",
 disciplinary_action:"Disciplinary Actions",incident:"Incidents - Accidents",
 near_miss:"Near Miss Reports",equipment_inspection:"Equipment Inspections",
 inventory:"Inventory Reports",toolbox:"Toolbox Talks",tool_toolbox:"Toolbox Talks",
 tool_training:"G&E Safety Training",training:"Quick Safety Orientation",
 registered_safety_orientation:"Register Safety Orientation"
};
function reportDay(value:unknown){
 const v=String(value||"");
 if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
 const d=new Date(v);if(!Number.isFinite(d.getTime()))return "";
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d).map(x=>[x.type,x.value]));
 return parts.year+"-"+parts.month+"-"+parts.day;
}
const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
function originalReportDay(record:any){
 const explicit=reportDay(record.snapshot?.original_report_date);
 if(explicit)return explicit;
 const match=String(record.report_number||"").match(/(?:^|[-_])(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])(?:[-_]|$)/);
 if(match)return match[1]+"-"+match[2]+"-"+match[3];
 return reportDay(record.created_at||record.finalized_at);
}
async function pdfIsComplete(blob:Blob){
 if(!blob||blob.size<32)return false;
 const [start,end]=await Promise.all([blob.slice(0,8).text(),blob.slice(-2048).text()]);
 return /^%PDF-\d\.\d/.test(start)&&/%%EOF\s*$/.test(end);
}
async function sendOne(row:any,connection:any,access:string){
 const record=must(await admin.from("report_documents").select("id,project_id,title,report_number,report_type,snapshot,pdf_path,document_status,version,finalized_at,created_at")
  .eq("id",row.report_id).eq("project_id",row.project_id).single());
 if(record.document_status!=="final"||!record.pdf_path||record.report_type.includes("medical"))throw Error("PDF is not finalized or is excluded.");
 const project=must(await admin.from("projects").select("name").eq("id",record.project_id).single());
 const downloaded=await admin.storage.from("final-reports").download(record.pdf_path);
 if(downloaded.error||!downloaded.data)throw Error("Finalized PDF file cannot be loaded.");
 const blob=downloaded.data;
 if(!(await pdfIsComplete(blob)))throw Error("Finalized PDF failed the integrity check.");
 if(blob.size>150*1024*1024)throw Error("PDF exceeds Dropbox standard upload limit; review large-file upload.");
 const folder="/GE ONE Reports";
 const projectFolder=folder+"/"+safe(project.name,"Project")+" "+record.project_id.slice(0,8);
 const typeFolder=projectFolder+"/"+safe(record.report_type,"Safety Reports");
 const reportFolder=typeFolder+"/"+safe(record.report_number,"Report")+" "+record.id.slice(0,8);
 for(const directory of [folder,projectFolder,typeFolder,reportFolder])await ensureFolder(access,directory);
 const name=safe(record.title,"Safety Report")+" "+dateLabel(record.snapshot?.original_report_date||
   record.finalized_at||record.created_at)+" By G&E.pdf";
 const remotePath=reportFolder+"/"+name;
 const saved=await providerCall("https://content.dropboxapi.com/2/files/upload",{
  method:"POST",headers:{
   Authorization:"Bearer "+access,"Content-Type":"application/octet-stream",
   "Dropbox-API-Arg":JSON.stringify({path:remotePath,mode:"overwrite",autorename:false,mute:true})
  },body:blob
 });
 if(!saved.id||Number(saved.size)!==blob.size)throw Error("Dropbox did not confirm the file's complete size.");
 return {remoteId:String(saved.id),remotePath};
}
async function sendMedical(row:any,access:string){
 const medical=must(await admin.from("employee_medical_followups")
  .select("id,project_id,followup_number,event_date")
  .eq("id",row.followup_id).eq("project_id",row.project_id).single());
 // No employee names, diagnoses or medical details are added to Dropbox folder metadata.
 const project=must(await admin.from("projects").select("name").eq("id",row.project_id).single());
 const expectedPrefix=row.project_id+"/";
 if(!row.pdf_path.startsWith(expectedPrefix)||!row.pdf_path.endsWith("/"+row.followup_id+"/final.pdf"))
  throw Error("Invalid confidential PDF storage path.");
 const downloaded=await admin.storage.from("medical-final-pdfs").download(row.pdf_path);
 if(downloaded.error||!downloaded.data||!(await pdfIsComplete(downloaded.data)))
  throw Error("Confidential medical PDF is missing or incomplete.");
 const blob=downloaded.data;
 if(blob.size>40*1024*1024)throw Error("Confidential medical PDF exceeds its storage limit.");
 const root="/GE ONE Reports";
 const jobsite=root+"/"+safe(project.name,"Project")+" "+row.project_id.slice(0,8);
 const confidential=jobsite+"/Medical Reports - Confidential";
 const item=confidential+"/"+safe(medical.followup_number,"Medical Report")+" "+row.followup_id.slice(0,8);
 for(const part of [root,jobsite,confidential,item])await ensureFolder(access,part);
 const remotePath=item+"/Medical Follow Up "+dateLabel(medical.event_date)+" By G&E.pdf";
 const response=await providerCall("https://content.dropboxapi.com/2/files/upload",{
  method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/octet-stream",
   "Dropbox-API-Arg":JSON.stringify({path:remotePath,mode:"overwrite",autorename:false,mute:true})},body:blob
 });
 if(!response.id||Number(response.size)!==blob.size)throw Error("Dropbox did not confirm confidential PDF size.");
 return {remoteId:String(response.id),remotePath};
}
async function archiveMedical(body:any,userId:string,role:string){
 if(!["admin","safety_director"].includes(role))return json({error:"Medical PDF permission required."},403);
 const project=String(body.project_id||""),followupId=String(body.followup_id||"");
 if(!/^[a-f0-9-]{36}$/i.test(project)||!/^[a-f0-9-]{36}$/i.test(followupId))
  return json({error:"Invalid medical report identifiers."},400);
 const member=must(await admin.from("project_members").select("user_id").eq("project_id",project).eq("user_id",userId).maybeSingle());
 if(!member)return json({error:"Jobsite access denied."},403);
 const control=must(await admin.from("dropbox_auto_control").select("enabled,connection_id").eq("id",1).maybeSingle());
 if(!control?.enabled||!control.connection_id)return json({enabled:false,queued:false});
 const existing=must(await admin.from("dropbox_automatic_medical_reports").select("followup_id").eq("followup_id",followupId).maybeSingle());
 if(existing)return json({enabled:true,queued:true,already_queued:true});
 const followup=must(await admin.from("employee_medical_followups").select("id").eq("id",followupId).eq("project_id",project).maybeSingle());
 if(!followup)return json({error:"Medical follow-up was not found in this jobsite."},404);
 const path=project+"/"+userId+"/"+followupId+"/final.pdf";
 const downloaded=await admin.storage.from("medical-final-pdfs").download(path);
 if(downloaded.error||!downloaded.data||!(await pdfIsComplete(downloaded.data)))
  return json({error:"Verified confidential PDF upload is required before queueing."},409);
 must(await admin.from("dropbox_automatic_medical_reports").insert({
  followup_id:followupId,project_id:project,pdf_path:path
 }));
 return json({enabled:true,queued:true});
}

async function runWorker(){
 const control=must(await admin.from("dropbox_auto_control").select("enabled,connection_id").eq("id",1).maybeSingle());
 if(!control?.enabled||!control.connection_id)return {enabled:false,sent:0,failed:0};
 const connection=must(await admin.from("backup_cloud_connections").select("id,provider,encrypted_token,app_key")
  .eq("id",control.connection_id).eq("provider","dropbox").maybeSingle());
 if(!connection)return {enabled:false,reason:"Dropbox authorization removed",sent:0,failed:0};
 const claimed=must(await admin.rpc("claim_dropbox_automatic_reports",{p_limit:2}));
 const medicalClaims=must(await admin.rpc("claim_dropbox_automatic_medical_reports",{p_limit:1}));
 let sent=0,failed=0,medicalSent=0,medicalFailed=0;
 if(!claimed.length&&!medicalClaims.length)return {enabled:true,sent,failed,medicalSent,medicalFailed};
 let token:string|null=null,tokenError="";
 try{token=await accessToken(connection)}catch(error:any){tokenError=String(error?.message||"Dropbox token refresh failed").slice(0,160);}
 for(const job of claimed){
  try{
   if(!token)throw Error(tokenError||"Reconnect Dropbox account.");
   const result=await sendOne(job,connection,token);
   const update=await admin.from("dropbox_automatic_reports")
    .update({status:"completed",remote_path:result.remotePath,remote_id:result.remoteId,completed_at:new Date().toISOString(),
     lock_token:null,lock_until:null,last_error:null,updated_at:new Date().toISOString()})
    .eq("report_id",job.report_id).eq("lock_token",job.lock_token);
   if(update.error)throw Error("Could not confirm Dropbox delivery.");
   sent++;
  }catch(error:any){
   failed++;
   const attempts=Number(job.attempts||1);
   const permanent=String(error?.message||"").includes("standard upload limit");
   const backoff=permanent?86400:Math.min(24*3600,60*Math.pow(2,Math.min(attempts,9)));
   await admin.from("dropbox_automatic_reports")
    .update({status:"failed",last_error:String(error?.message||"Dropbox copy failed").slice(0,180),
     next_attempt_at:new Date(Date.now()+backoff*1000).toISOString(),
     lock_token:null,lock_until:null,updated_at:new Date().toISOString()})
    .eq("report_id",job.report_id).eq("lock_token",job.lock_token);
  }
 }
 for(const job of medicalClaims){
  try{
   if(!token)throw Error(tokenError||"Reconnect Dropbox account.");
   const result=await sendMedical(job,token);
   const update=await admin.from("dropbox_automatic_medical_reports").update({
    status:"completed",remote_id:result.remoteId,remote_path:result.remotePath,
    completed_at:new Date().toISOString(),lock_token:null,lock_until:null,last_error:null,updated_at:new Date().toISOString()
   }).eq("followup_id",job.followup_id).eq("lock_token",job.lock_token);
   if(update.error)throw Error("Confidential PDF delivery could not be confirmed.");
   medicalSent++;
  }catch(error:any){
   medicalFailed++;
   const wait=Math.min(86400,60*2**Math.min(Number(job.attempts||1),9));
   await admin.from("dropbox_automatic_medical_reports").update({
    status:"failed",last_error:String(error?.message||"Medical PDF transfer failed").slice(0,160),
    next_attempt_at:new Date(Date.now()+wait*1000).toISOString(),
    lock_token:null,lock_until:null,updated_at:new Date().toISOString()
   }).eq("followup_id",job.followup_id).eq("lock_token",job.lock_token);
  }
 }
 return {enabled:true,sent,failed,medicalSent,medicalFailed};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const body=await req.json();
  if(body.action==="process"){
   if(!await authorizeWorker(req.headers.get("x-ge-dropbox-worker")||""))return json({error:"Unauthorized"},401);
   return json(await runWorker());
  }
  if(body.action==="queue_medical"){
   const authorization=req.headers.get("Authorization")||"";
   const client=createClient(env("SUPABASE_URL"),env("SUPABASE_ANON_KEY"),
    {global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
   const auth=await client.auth.getUser();
   if(auth.error||!auth.data?.user)return json({error:"Sign in again."},401);
   const profile=must(await admin.from("profiles").select("role").eq("id",auth.data.user.id).single());
   return await archiveMedical(body,auth.data.user.id,profile.role);
  }
  if(body.action==="enabled"){
   const authorization=req.headers.get("Authorization")||"";
   const client=createClient(env("SUPABASE_URL"),env("SUPABASE_ANON_KEY"),
    {global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
   const auth=await client.auth.getUser();
   if(auth.error||!auth.data?.user)return json({error:"Sign in again."},401);
   if(typeof body.project_id!=="string"||!/^[a-f0-9-]{36}$/i.test(body.project_id))
    return json({error:"Choose a valid project."},400);
   const profile=must(await admin.from("profiles").select("role").eq("id",auth.data.user.id).single());
   if(profile.role!=="admin"){
    const member=must(await admin.from("project_members").select("user_id")
     .eq("project_id",body.project_id).eq("user_id",auth.data.user.id).maybeSingle());
    if(!member)return json({error:"Project access denied."},403);
   }
   const control=must(await admin.from("dropbox_auto_control").select("enabled").eq("id",1).maybeSingle());
   let medical_queued=false;
   if(["admin","safety_director"].includes(profile.role)&&body.followup_id){
    const existing=must(await admin.from("dropbox_automatic_medical_reports").select("followup_id")
     .eq("project_id",body.project_id).eq("followup_id",body.followup_id).maybeSingle());
    const member=must(await admin.from("project_members").select("user_id")
     .eq("project_id",body.project_id).eq("user_id",auth.data.user.id).maybeSingle());
    medical_queued=Boolean(member&&existing);
   }
   return json({enabled:Boolean(control?.enabled),medical_queued});
  }
  return json({error:"Unknown action"},400);
 }catch{return json({error:"Automatic report synchronization failed."},500)}
});
