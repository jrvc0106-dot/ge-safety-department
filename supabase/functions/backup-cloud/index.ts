import {createClient} from "npm:@supabase/supabase-js@2.117.2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const providers=["google_drive","dropbox"];
const env=(key)=>Deno.env.get(key)||"";
const admin=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
const callback=()=>env("SUPABASE_URL")+"/functions/v1/backup-cloud?callback=1";
const credentials=p=>p==="google_drive"?{id:env("GOOGLE_BACKUP_CLIENT_ID"),secret:env("GOOGLE_BACKUP_CLIENT_SECRET")}:{id:env("DROPBOX_BACKUP_APP_KEY"),secret:env("DROPBOX_BACKUP_APP_SECRET")};
const must=r=>{if(r.error)throw Error("Cloud connection storage is unavailable.");return r.data};
async function request(url,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(url,{...options,signal:controller.signal});const text=await response.text();if(!response.ok)throw Error(response.status===401?"Cloud authorization expired. Reconnect the account.":response.status===429?"Cloud provider limit reached. Try again later.":"Cloud provider could not complete the request.");return text?JSON.parse(text):{}}finally{clearTimeout(timer)}}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
async function cryptKey(){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env("SUPABASE_SERVICE_ROLE_KEY")));return crypto.subtle.importKey("raw",digest,"AES-GCM",false,["encrypt","decrypt"])}
async function encrypt(value){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await cryptKey(),new TextEncoder().encode(value)));return hex(iv)+"."+hex(cipher)}
async function decrypt(value){const [a,b]=value.split("."),bytes=s=>new Uint8Array(s.match(/../g).map(x=>parseInt(x,16)));return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(a)},await cryptKey(),bytes(b)))}
async function authorizeUser(id,project){
 const profile=must(await admin.from("profiles").select("role").eq("id",id).single());
 if(profile?.role!=="admin")throw Object.assign(Error("Admin access required."),{status:403});
 const found=must(await admin.from("projects").select("id").eq("id",project).maybeSingle());if(!found)throw Error("Project access denied.");
 if(profile.role!=="admin"){const member=must(await admin.from("project_members").select("user_id").eq("project_id",project).eq("user_id",id).maybeSingle());if(!member)throw Error("Project access denied.")}
}
async function token(p,params){const c=credentials(p);if(!c.id||!c.secret)throw Error("Configure the cloud provider credentials first.");return request(p==="google_drive"?"https://oauth2.googleapis.com/token":"https://api.dropboxapi.com/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:c.id,client_secret:c.secret,...params})})}
async function access(connection){const result=await token(connection.provider,{grant_type:"refresh_token",refresh_token:await decrypt(connection.encrypted_token)});if(!result.access_token)throw Error("Reconnect the cloud account.");return result.access_token}
async function folder(p,accessToken,name){
 if(p==="dropbox"){const row=await request("https://api.dropboxapi.com/2/files/create_folder_v2",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({path:"/"+name,autorename:false})});if(!row.metadata?.path_lower)throw Error("Could not create the backup folder.");return row.metadata.path_lower;}
 const row=await request("https://www.googleapis.com/drive/v3/files?fields=id",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder"})});if(!row.id)throw Error("Could not create the backup folder.");return row.id;
}
async function upload(p,accessToken,root,name,blob){
 let row;
 if(p==="dropbox"){const path=root+"/"+name;row=await request("https://content.dropboxapi.com/2/files/upload",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/octet-stream","Dropbox-API-Arg":JSON.stringify({path,mode:"overwrite",autorename:false,mute:true})},body:blob});}
 else{const boundary="ge_"+crypto.randomUUID(),metadata=JSON.stringify({name,parents:[root]});row=await request("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"multipart/related; boundary="+boundary},body:new Blob(["--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+metadata+"\r\n--"+boundary+"\r\nContent-Type: "+(blob.type||"application/octet-stream")+"\r\n\r\n",blob,"\r\n--"+boundary+"--\r\n"])});}
 if(!row.id||Number(row.size)!==blob.size)throw Error("The cloud provider did not confirm the complete file size.");return row.id;
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 const query=new URL(req.url).searchParams;
 if(req.method==="GET"&&query.get("health")==="1")return json({configured:Object.fromEntries(providers.map(p=>[p,Boolean(credentials(p).id&&credentials(p).secret)]))});
 if(req.method==="GET"&&query.get("callback")==="1"){
  let message="Connection could not be completed. Return to the app and try Connect again.",status=400;
  try{
   const state=query.get("state");if(!state)throw Error("Missing OAuth state.");
   const record=must(await admin.from("backup_cloud_oauth_states").delete().eq("state",state).gt("expires_at",new Date().toISOString()).select("*").maybeSingle());
   if(!record||query.get("error"))throw Error("Authorization canceled or expired.");
   await authorizeUser(record.user_id,record.project_id);
   const code=query.get("code");if(!code)throw Error("Missing authorization code.");
   const result=await token(record.provider,{grant_type:"authorization_code",code,redirect_uri:callback()});if(!result.refresh_token||!result.access_token)throw Error("Offline access was not granted.");
   const account=record.provider==="google_drive"?await request("https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)",{headers:{Authorization:"Bearer "+result.access_token}}):await request("https://api.dropboxapi.com/2/users/get_current_account",{method:"POST",headers:{Authorization:"Bearer "+result.access_token}});
   const label=record.provider==="google_drive"?(account.user?.emailAddress||account.user?.displayName||"Google Drive"):(account.email||account.name?.display_name||"Dropbox");
   must(await admin.from("backup_cloud_connections").upsert({id:crypto.randomUUID(),project_id:record.project_id,provider:record.provider,encrypted_token:await encrypt(result.refresh_token),account_label:label,connected_by:record.user_id,connected_at:new Date().toISOString()},{onConflict:"project_id,provider"}));
   message="Account connected successfully. Close this window and return to Cloud Backup Center, then refresh the connection status.";status=200;
  }catch{}
  return new Response("<!doctype html><html><meta name=viewport content='width=device-width,initial-scale=1'><title>G&E Cloud Backup</title><body><h1>G&E Cloud Backup</h1><p>"+message+"</p><p>Cierra esta ventana y vuelve a Cloud Backup Center.</p></body></html>",{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'"}});
 }
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 let lease=null;
 try{
  const authorization=req.headers.get("Authorization")||"";
  const client=createClient(env("SUPABASE_URL"),env("SUPABASE_ANON_KEY"),{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const auth=await client.auth.getUser();if(auth.error||!auth.data?.user)return json({error:"Sign in again."},401);
  const body=await req.json(),project=body.project_id,p=body.provider;
  if(typeof project!=="string"||!/^[0-9a-f-]{36}$/i.test(project))return json({error:"Select a valid project."},400);
  await authorizeUser(auth.data.user.id,project);
  if(body.action==="status"){
   const settings=must(await admin.from("backup_cloud_settings").select("provider").eq("project_id",project).maybeSingle());
   const connections=must(await admin.from("backup_cloud_connections").select("provider,account_label,connected_at").eq("project_id",project));
   const backups=must(await admin.from("cloud_backups").select("id").eq("project_id",project).order("created_at",{ascending:false}).limit(30));
   const exports=backups.length?must(await admin.from("backup_cloud_exports").select("backup_id,provider,status,total_files,copied,error_message,completed_at").in("backup_id",backups.map(x=>x.id))):[];
   return json({provider:settings?.provider||"supabase",providers:providers.map(provider=>({provider,configured:Boolean(credentials(provider).id&&credentials(provider).secret),connection:connections.find(x=>x.provider===provider)||null})),exports:exports.map(x=>({...x,copied_count:x.copied.length,copied:undefined})),callback_url:callback()});
  }

  if(body.action==="local_download"){
   const backup=must(await admin.from("cloud_backups").select("*").eq("id",body.backup_id).eq("project_id",project).maybeSingle());
   if(!backup||backup.status!=="completed"||!backup.verified_at||!backup.manifest_path)throw Error("A verified completed backup is required.");
   if(backup.total_bytes>200*1024*1024)throw Error("Local backup limit is 200 MB. Use a cloud destination for larger backups.");
   const downloaded=await admin.storage.from("cloud-backups").download(backup.manifest_path);
   if(downloaded.error||!downloaded.data)throw Error("Backup manifest is unavailable.");
   const manifest=JSON.parse(await downloaded.data.text());
   if(manifest.format!=="G&E Safety Cloud Backup v2"||manifest.project_id!==project||manifest.backup_id!==backup.id||!Array.isArray(manifest.files)||manifest.files.length!==backup.file_count)throw Error("This backup cannot be downloaded locally. Create a new verified backup.");
   const files=manifest.files.map(file=>({path:file.backup_path,name:file.backup_path?.slice(backup.id.length+1),size:file.size,sha256:file.sha256}));
   files.push({path:backup.manifest_path,name:"manifest.json",size:downloaded.data.size,sha256:hex(new Uint8Array(await crypto.subtle.digest("SHA-256",await downloaded.data.arrayBuffer())))});
   if(files.length>65535||files.some(file=>typeof file.path!=="string"||!file.path.startsWith(backup.id+"/")||!file.name||file.name.includes("\\")||file.name.split("/").some(part=>!part||part==="."||part==="..")||!Number.isSafeInteger(file.size)||file.size<0||!/^[a-f0-9]{64}$/.test(file.sha256)))throw Error("Invalid backup manifest.");
   if(new Set(files.map(file=>file.name)).size!==files.length)throw Error("Duplicate backup files.");
   const links=[];
   for(let i=0;i<files.length;i+=100){const signed=await admin.storage.from("cloud-backups").createSignedUrls(files.slice(i,i+100).map(file=>file.path),900);if(signed.error||signed.data?.some(file=>file.error||!file.signedUrl))throw Error("Backup download could not be prepared.");links.push(...signed.data);}
   return json({backup_number:backup.backup_number,total_bytes:files.reduce((sum,file)=>sum+file.size,0),files:files.map((file,i)=>({...file,url:links[i].signedUrl}))});
  }
  if(!["supabase",...providers].includes(p))return json({error:"Select a supported provider."},400);
  if(body.action==="connect"){
   if(!providers.includes(p))return json({error:"Supabase is already available."},400);
   const c=credentials(p);if(!c.id||!c.secret)return json({error:"Provider setup is pending. An administrator must configure "+(p==="google_drive"?"GOOGLE_BACKUP_CLIENT_ID and GOOGLE_BACKUP_CLIENT_SECRET":"DROPBOX_BACKUP_APP_KEY and DROPBOX_BACKUP_APP_SECRET")+" in Supabase Secrets.",code:"NOT_CONFIGURED"},503);
   const state=crypto.randomUUID();must(await admin.from("backup_cloud_oauth_states").delete().lt("expires_at",new Date().toISOString()));
   must(await admin.from("backup_cloud_oauth_states").insert({state,project_id:project,provider:p,user_id:auth.data.user.id,expires_at:new Date(Date.now()+600000).toISOString()}));
   const url=new URL(p==="google_drive"?"https://accounts.google.com/o/oauth2/v2/auth":"https://www.dropbox.com/oauth2/authorize");
   for(const [k,v] of Object.entries({client_id:c.id,redirect_uri:callback(),response_type:"code",state}))url.searchParams.set(k,v);
   if(p==="google_drive"){url.searchParams.set("scope","https://www.googleapis.com/auth/drive.file");url.searchParams.set("access_type","offline");url.searchParams.set("prompt","consent");}
   else{url.searchParams.set("token_access_type","offline");url.searchParams.set("scope","files.content.write files.metadata.read account_info.read");}
   return json({authorization_url:url.toString()});
  }
  const connection=providers.includes(p)?must(await admin.from("backup_cloud_connections").select("*").eq("project_id",project).eq("provider",p).maybeSingle()):null;
  if(body.action==="select"){
   if(p!=="supabase"&&!connection)return json({error:"Connect this provider before selecting it as primary backup storage."},409);
   must(await admin.from("backup_cloud_settings").upsert({project_id:project,provider:p,updated_by:auth.data.user.id,updated_at:new Date().toISOString()}));return json({ok:true});
  }
  if(body.action==="disconnect"){
   must(await admin.from("backup_cloud_connections").delete().eq("project_id",project).eq("provider",p));
   must(await admin.from("backup_cloud_settings").update({provider:"supabase",updated_by:auth.data.user.id}).eq("project_id",project).eq("provider",p));return json({ok:true});
  }
  if(body.action!=="export")return json({error:"Unknown action."},400);
  if(!connection)return json({error:"Connect the destination first."},409);
  const backup=must(await admin.from("cloud_backups").select("*").eq("id",body.backup_id).eq("project_id",project).maybeSingle());if(!backup||backup.status!=="completed"||!backup.manifest_path)throw Error("A completed backup is required.");
  const leaseToken=crypto.randomUUID(),claimed=must(await admin.rpc("claim_backup_cloud_export",{p_backup:backup.id,p_provider:p,p_connection:connection.id,p_token:leaseToken}));if(!claimed)return json({error:"This copy is already running. Wait and refresh its status.",code:"BUSY"},409);
  lease={backup_id:backup.id,provider:p,token:leaseToken};
  const job=must(await admin.from("backup_cloud_exports").select("*").eq("backup_id",backup.id).eq("provider",p).single());
  if(job.connection_id!==connection.id)throw Error("The connected cloud account changed. Create a new backup for this account.");
  if(job.status==="completed")return json({ok:true,done:true,copied_count:job.copied.length,total_files:job.total_files});
  const download=await admin.storage.from("cloud-backups").download(backup.manifest_path);if(download.error||!download.data)throw Error("Backup manifest is unavailable.");
  const manifest=JSON.parse(await download.data.text());
  const files=[...(manifest.files||[]).map((x,i)=>({path:x.backup_path,name:String(i+1).padStart(5,"0")+"-"+x.path.split("/").pop(),hash:x.sha256})),{path:backup.manifest_path,name:"manifest.json"}];
  if(files.some(x=>typeof x.path!=="string"||!x.path.startsWith(backup.id+"/")||x.path.includes("..")))throw Error("Invalid backup manifest.");
  const accessToken=await access(connection),root=job.folder_id||await folder(p,accessToken,"GE-"+project+"-"+backup.backup_number),copied=job.copied;
  must(await admin.from("backup_cloud_exports").update({folder_id:root,total_files:files.length,status:"pending",error_message:null}).eq("backup_id",backup.id).eq("provider",p).eq("lock_token",leaseToken));
  const started=Date.now();let processed=0;
  for(const file of files){if(copied.some(x=>x.path===file.path))continue;if(processed>=3||Date.now()-started>40000)break;
   const source=file.path===backup.manifest_path?download:await admin.storage.from("cloud-backups").download(file.path);if(source.error||!source.data)throw Error("A backup file is unavailable. Retry this copy.");
   if(file.hash&&hex(new Uint8Array(await crypto.subtle.digest("SHA-256",await source.data.arrayBuffer())))!==file.hash)throw Error("Backup file integrity check failed.");
   const id=await upload(p,accessToken,root,file.name,source.data);copied.push({path:file.path,remote_id:id,size:source.data.size});processed++;
   must(await admin.from("backup_cloud_exports").update({copied}).eq("backup_id",backup.id).eq("provider",p).eq("lock_token",leaseToken));
  }
  const done=copied.length===files.length;
  must(await admin.from("backup_cloud_exports").update({status:done?"completed":"pending",completed_at:done?new Date().toISOString():null}).eq("backup_id",backup.id).eq("provider",p).eq("lock_token",leaseToken));
  return json({ok:true,done,copied_count:copied.length,total_files:files.length});
 }catch(error){
  const message=error?.name==="AbortError"?"The cloud request timed out. Retry to resume the copy.":error?.message||"Cloud backup is temporarily unavailable.";
  if(lease)await admin.from("backup_cloud_exports").update({status:"failed",error_message:message}).eq("backup_id",lease.backup_id).eq("provider",lease.provider).eq("lock_token",lease.token);
  return json({error:message},error?.status||400);
 }finally{
  if(lease)await admin.from("backup_cloud_exports").update({lock_until:null,lock_token:null}).eq("backup_id",lease.backup_id).eq("provider",lease.provider).eq("lock_token",lease.token);
 }
});
