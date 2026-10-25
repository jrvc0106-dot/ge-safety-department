import {createClient} from "npm:@supabase/supabase-js@2.117.2";

// Isolated from the upload worker. A failed authorization or verification never deletes a PDF.
const env=(name:string)=>Deno.env.get(name)||"";
const admin=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-ge-dropbox-worker",
 "Access-Control-Allow-Methods":"POST,OPTIONS"}
});
const must=(result:any)=>{if(result.error)throw Error("Archive service is unavailable.");return result.data};
async function workerAuthorized(value:string){
 if(!/^[a-f0-9]{64}$/.test(value))return false;
 const row=must(await admin.from("dropbox_automatic_worker_key").select("secret").eq("id",1).single());
 const hashes=await Promise.all([value,row.secret].map(v=>crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v)))));
 const a=new Uint8Array(hashes[0]),b=new Uint8Array(hashes[1]);
 let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
async function accessToken(connection:any){
 const [iv,cipher]=String(connection.encrypted_token).split(".");
 const bytes=(v:string)=>new Uint8Array((v.match(/../g)||[]).map(x=>parseInt(x,16)));
 const key=await crypto.subtle.importKey("raw",
  await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env("SUPABASE_SERVICE_ROLE_KEY"))),
  "AES-GCM",false,["decrypt"]);
 const refresh=new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv)},key,bytes(cipher)));
 const appKey=String(connection.app_key||env("DROPBOX_BACKUP_APP_KEY")||"");
 if(!appKey)throw Error("Dropbox authorization is incomplete.");
 const secret=connection.app_key?"":env("DROPBOX_BACKUP_APP_SECRET");
 const body=new URLSearchParams({grant_type:"refresh_token",refresh_token:refresh,client_id:appKey,
  ...(secret?{client_secret:secret}:{})});
 const response=await fetch("https://api.dropboxapi.com/oauth2/token",
  {method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
 if(!response.ok)throw Error("Dropbox token renewal failed.");
 const data=await response.json();if(!data.access_token)throw Error("Dropbox token missing.");
 return String(data.access_token);
}
async function companyAccess(){
 const control=must(await admin.from("dropbox_auto_control").select("enabled,connection_id").eq("id",1).maybeSingle());
 if(!control?.enabled||!control.connection_id)throw Error("Dropbox backup is disconnected.");
 const connection=must(await admin.from("backup_cloud_connections")
  .select("id,provider,encrypted_token,app_key").eq("id",control.connection_id).eq("provider","dropbox").maybeSingle());
 if(!connection)throw Error("Dropbox authorization is missing.");
 return accessToken(connection);
}
async function dropboxMetadata(token:string,identifier:string){
 const response=await fetch("https://api.dropboxapi.com/2/files/get_metadata",{
  method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({path:identifier})});
 if(!response.ok)throw Error("Dropbox could not read the archived file metadata. Check files.metadata.read.");
 return response.json();
}
async function remotePdf(token:string,identifier:string){
 const response=await fetch("https://content.dropboxapi.com/2/files/download",{
  method:"POST",headers:{"Authorization":"Bearer "+token,"Dropbox-API-Arg":JSON.stringify({path:identifier})}
 });
 if(!response.ok)throw Error("Dropbox file download failed. Enable files.content.read and reconnect in Cloud Backup.");
 const header=response.headers.get("Dropbox-API-Result");
 const metadata=header?JSON.parse(header):{};
 const body=await response.blob();
 return {metadata,body};
}
async function sha256(blob:Blob){
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",await blob.arrayBuffer()));
 return Array.from(digest,b=>b.toString(16).padStart(2,"0")).join("");
}
async function completePdf(blob:Blob){
 return blob.size>=32 && /^%PDF-\d\.\d/.test(await blob.slice(0,8).text())
  && /%%EOF\s*$/.test(await blob.slice(-2048).text());
}
async function verify(row:any,record:any,token:string){
 if(record.document_status!=="final"||record.report_type.includes("medical")||!record.pdf_path)
  throw Error("Non-final or medical PDFs are excluded from cleanup.");
 if(record.project_id!==row.project_id||!row.remote_id||!row.remote_path)
  throw Error("Archive metadata does not match the report.");
 const origin=await admin.storage.from("final-reports").download(record.pdf_path);
 if(origin.error||!origin.data)throw Error("Original PDF is unavailable. No deletion performed.");
 const original=origin.data;
 if(original.size>16*1024*1024)throw Error("PDF exceeds safe 16 MB verification limit; original retained.");
 if(!(await completePdf(original)))throw Error("Original PDF is damaged; original retained.");
 const meta=await dropboxMetadata(token,row.remote_id);
 if(meta.id!==row.remote_id||meta[".tag"]!=="file"||Number(meta.size)!==original.size)
  throw Error("Dropbox file identity or size differs from GE ONE.");
 const remote=await remotePdf(token,row.remote_id);
 if(remote.metadata?.id!==row.remote_id||remote.body.size!==original.size||!(await completePdf(remote.body)))
  throw Error("Dropbox downloaded file is incomplete or different.");
 const originalHash=await sha256(original),remoteHash=await sha256(remote.body);
 if(originalHash!==remoteHash)throw Error("PDF integrity mismatch. Original preserved.");
 if(row.cleanup_verified_sha256&&row.cleanup_verified_sha256!==originalHash)
  throw Error("PDF changed after initial verification. Original preserved.");
 return {hash:originalHash,bytes:original.size,path:record.pdf_path};
}
async function clearLock(row:any,changes:any){
 const done=await admin.from("dropbox_automatic_reports").update({
  ...changes,cleanup_lock_token:null,cleanup_lock_until:null,updated_at:new Date().toISOString()
 }).eq("report_id",row.report_id).eq("cleanup_lock_token",row.cleanup_lock_token).select("report_id");
 if(done.error||done.data?.length!==1)throw Error("Could not confirm archive state.");
}
async function processOne(){
 const settings=must(await admin.from("dropbox_cleanup_control").select("enabled,retention_days").eq("id",1).maybeSingle());
 if(!settings?.enabled)return {enabled:false};
 const candidates=must(await admin.rpc("claim_dropbox_cleanup_candidate"));
 const row=candidates?.[0];if(!row)return {enabled:true,processed:0};
 try{
  const record=must(await admin.from("report_documents")
   .select("id,project_id,report_type,pdf_path,document_status").eq("id",row.report_id).maybeSingle());
  if(!record)throw Error("PDF source metadata is missing.");
  const token=await companyAccess();
  const verified=await verify(row,record,token);
  if(!row.cleanup_verified_at){
   await clearLock(row,{cleanup_verified_at:new Date().toISOString(),
    cleanup_verified_sha256:verified.hash,cleanup_error:null,cleanup_retry_at:new Date().toISOString()});
   return {enabled:true,processed:1,verified:1,deleted:0};
  }
  const waitMs=Math.max(7,Number(settings.retention_days))*86400000;
  if(Date.now()-new Date(row.cleanup_verified_at).getTime()<waitMs){
   await clearLock(row,{cleanup_retry_at:new Date(Date.now()+3600000).toISOString()});
   return {enabled:true,processed:1,verified:1,deleted:0};
  }
  // Never delete an object used by another document version or report.
  const duplicate=must(await admin.from("report_documents").select("id")
   .eq("pdf_path",record.pdf_path).neq("id",record.id).limit(1));
  if(duplicate.length)throw Error("Shared PDF storage path. Original retained.");
  const current=must(await admin.from("report_documents").select("pdf_path,document_status,project_id")
   .eq("id",record.id).single());
  if(current.pdf_path!==verified.path||current.document_status!=="final"||current.project_id!==row.project_id)
   throw Error("Report changed during verification. Original retained.");
  // Only now permanently free the one PDF blob. Source records, metadata, signatures and photos remain.
  const result=await admin.storage.from("final-reports").remove([verified.path]);
  if(result.error||!result.data?.some((x:any)=>x.name===verified.path||verified.path.endsWith("/"+x.name)))
   throw Error("GE ONE did not confirm PDF storage cleanup.");
  await clearLock(row,{cleanup_archived_at:new Date().toISOString(),
   cleanup_original_path:verified.path,cleanup_bytes_freed:verified.bytes,cleanup_error:null});
  return {enabled:true,processed:1,verified:1,deleted:1,bytes_freed:verified.bytes};
 }catch(error:any){
  // Keep a blocked archive recoverable and retry slowly, without touching any other report.
  const detail=String(error?.message||"Archive check failed").slice(0,180);
  await clearLock(row,{cleanup_error:detail,cleanup_retry_at:new Date(Date.now()+3600000).toISOString()});
  return {enabled:true,processed:1,deleted:0,error:detail};
 }
}
async function authorizedProject(req:Request,projectId:string){
 if(!/^[a-f0-9-]{36}$/i.test(projectId))return null;
 const authHeader=req.headers.get("Authorization")||"";
 const client=createClient(env("SUPABASE_URL"),env("SUPABASE_ANON_KEY"),
  {auth:{persistSession:false},global:{headers:{Authorization:authHeader}}});
 const auth=await client.auth.getUser();if(auth.error||!auth.data.user)return null;
 const profile=must(await admin.from("profiles").select("role").eq("id",auth.data.user.id).maybeSingle());
 if(profile?.role!=="admin"){
  const member=must(await admin.from("project_members").select("user_id").eq("user_id",auth.data.user.id).eq("project_id",projectId).maybeSingle());
  if(!member)return null;
 }
 return auth.data.user.id;
}
async function archiveLink(body:any,req:Request){
 const projectId=String(body.project_id||""),reportId=String(body.report_id||"");
 if(!await authorizedProject(req,projectId))return json({error:"Project access denied."},403);
 if(!/^[a-f0-9-]{36}$/i.test(reportId))return json({error:"Invalid report."},400);
 const row=must(await admin.from("dropbox_automatic_reports")
  .select("remote_id,remote_path,status,cleanup_archived_at").eq("project_id",projectId).eq("report_id",reportId).maybeSingle());
 if(!row?.cleanup_archived_at||row.status!=="completed"||!row.remote_id)
  return json({error:"This report has not been archived to Dropbox."},409);
 const token=await companyAccess();
 const response=await fetch("https://api.dropboxapi.com/2/files/get_temporary_link",{
  method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
  body:JSON.stringify({path:row.remote_id})});
 if(!response.ok)return json({error:"Dropbox archived PDF is unavailable. Reconnect Dropbox permissions if needed."},502);
 const result=await response.json();
 if(result?.metadata?.id!==row.remote_id||typeof result?.link!=="string")return json({error:"Dropbox returned incorrect file metadata."},502);
 const uri=new URL(result.link);
 if(uri.protocol!=="https:"||!uri.hostname.endsWith(".dropboxusercontent.com"))
  return json({error:"Unsafe cloud PDF link blocked."},502);
 return json({url:uri.toString(),archived:true});
}
async function archiveStatus(body:any,req:Request){
 const project=String(body.project_id||"");
 if(!await authorizedProject(req,project))return json({error:"Project access denied."},403);
 const rows=must(await admin.from("dropbox_automatic_reports").select("report_id,cleanup_archived_at,cleanup_bytes_freed")
  .eq("project_id",project).not("cleanup_archived_at","is",null).limit(5000));
 return json({archived:rows.map((x:any)=>({id:x.report_id,archived_at:x.cleanup_archived_at,bytes:x.cleanup_bytes_freed}))});
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-ge-dropbox-worker","Access-Control-Allow-Methods":"POST,OPTIONS"}});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const body=await req.json();
  if(body?.action==="process"){
   if(!await workerAuthorized(req.headers.get("x-ge-dropbox-worker")||""))return json({error:"Unauthorized"},401);
   return json(await processOne());
  }
  if(body?.action==="archive_link")return archiveLink(body,req);
  if(body?.action==="archive_status")return archiveStatus(body,req);
  return json({error:"Unknown action"},400);
 }catch{return json({error:"Dropbox archive is temporarily unavailable."},500)}
});
