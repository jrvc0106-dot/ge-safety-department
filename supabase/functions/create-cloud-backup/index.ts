import {createClient} from "npm:@supabase/supabase-js@2.117.2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return reply({ok:false,error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const client=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}},auth:{persistSession:false}}),admin=createClient(url,service,{auth:{persistSession:false}});
 let backupId=null;
 const checked=r=>{if(r.error)throw Error("A required backup record could not be read or saved.");return r.data};
 try{
  const auth=await client.auth.getUser();if(auth.error||!auth.data?.user)return reply({ok:false,error:"Sign in again."},401);
  const user=auth.data.user,body=await req.json(),project=body.project_id;if(typeof project!=="string"||!/^[0-9a-f-]{36}$/i.test(project))throw Error("Select a valid project.");
  const profile=checked(await admin.from("profiles").select("role").eq("id",user.id).single());if(profile?.role!=="admin")return reply({ok:false,error:"Admin required."},403);
  const found=checked(await admin.from("projects").select("id").eq("id",project).maybeSingle());if(!found)return reply({ok:false,error:"Project access denied."},403);
  if(profile.role!=="admin"){const member=checked(await admin.from("project_members").select("project_id").eq("project_id",project).eq("user_id",user.id).maybeSingle());if(!member)return reply({ok:false,error:"Project access denied."},403);}
  const num="CB-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+crypto.randomUUID().slice(0,6).toUpperCase();
  const backup=checked(await admin.from("cloud_backups").insert({project_id:project,created_by:user.id,backup_number:num,provider:"supabase",status:"running"}).select().single());backupId=backup.id;
  const snapshot={format:"G&E Safety Cloud Backup v2",backup_number:num,backup_id:backup.id,created_at:new Date().toISOString(),project_id:project,data:{},files:[]};
  async function rows(table,filter){const all=[];for(let offset=0;;offset+=500){const batch=checked(await filter(admin.from(table).select("*")).order(table==="project_members"?"user_id":"id").range(offset,offset+499));all.push(...(batch||[]));if(!batch||batch.length<500)break;}return all}
  for(const table of ["projects","project_members","observations","daily_safety_walks","safety_discipline","incident_reports","equipment_inspections","report_documents","inventory_items","safety_orientations"]){snapshot.data[table]=await rows(table,q=>q.eq(table==="projects"?"id":"project_id",project));}
  async function children(table,parent,fk){const ids=(snapshot.data[parent]||[]).map(x=>x.id),all=[];for(let i=0;i<ids.length;i+=200)all.push(...await rows(table,q=>q.in(fk,ids.slice(i,i+200))));snapshot.data[table]=all;return all}
  await children("corrective_actions","observations","observation_id");
  await children("daily_safety_walk_items","daily_safety_walks","walk_id");
  await children("report_document_events","report_documents","report_document_id");
  await children("safety_orientation_events","safety_orientations","orientation_id");
  const refs=new Map(),add=(bucket,path)=>{if(path)refs.set(bucket+":"+path,{bucket,path})};
  for(const [table,parent,fk,bucket] of [
   ["observation_photos","observations","observation_id","observation-photos"],
   ["daily_safety_walk_photos","daily_safety_walk_items","item_id","daily-safety-walks"],
   ["discipline_photos","safety_discipline","discipline_id","discipline-evidence"],
   ["incident_report_photos","incident_reports","incident_id","incident-evidence"],
   ["equipment_inspection_photos","equipment_inspections","inspection_id","equipment-inspections"],
   ["inventory_item_photos","inventory_items","inventory_item_id","inventory-photos"]
  ])for(const row of await children(table,parent,fk))add(bucket,row.path);
  for(const doc of snapshot.data.report_documents)add("final-reports",doc.pdf_path);
  for(const item of snapshot.data.inventory_items)add("inventory-photos",item.photo_path);
  for(const item of snapshot.data.safety_orientations){for(const field of ["orientation_photo_path","sticker_photo_path","orientation_document_photo_path"])add("orientation-photos",item[field]);for(const path of item.certificate_photo_paths||[])add("orientation-photos",path);}
  let bytes=0;
  for(const file of refs.values()){
   const read=await admin.storage.from(file.bucket).download(file.path);if(read.error||!read.data)throw Error("A required evidence file could not be copied. Backup is incomplete.");
   const blob=read.data,path=backup.id+"/files/"+file.bucket+"/"+file.path;
   const up=await admin.storage.from("cloud-backups").upload(path,blob,{contentType:blob.type||"application/octet-stream",upsert:false});if(up.error)throw Error("An evidence file could not be stored. Backup is incomplete.");
   const check=await admin.storage.from("cloud-backups").download(path);if(check.error||!check.data)throw Error("Backup verification failed.");
   const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await b.arrayBuffer())),x=>x.toString(16).padStart(2,"0")).join("");
   const sha256=await hash(blob);if(check.data.size!==blob.size||await hash(check.data)!==sha256)throw Error("Backup verification failed.");
   bytes+=blob.size;snapshot.files.push({...file,backup_path:path,size:blob.size,sha256});
  }
  const manifestPath=backup.id+"/manifest.json",manifest=new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json"});
  const saved=await admin.storage.from("cloud-backups").upload(manifestPath,manifest,{contentType:"application/json"});if(saved.error)throw Error("The backup manifest could not be saved.");
  const verified=await admin.storage.from("cloud-backups").download(manifestPath);if(verified.error||!verified.data||await verified.data.text()!==await manifest.text())throw Error("Manifest verification failed.");
  bytes+=manifest.size;checked(await admin.from("cloud_backups").update({status:"completed",manifest_path:manifestPath,file_count:snapshot.files.length,total_bytes:bytes,verified_at:new Date().toISOString(),completed_at:new Date().toISOString(),error_message:null}).eq("id",backup.id));
  return reply({ok:true,id:backup.id,backup_number:num,file_count:snapshot.files.length,total_bytes:bytes});
 }catch(error){const message=error?.message||"Backup could not be completed.";if(backupId)await admin.from("cloud_backups").update({status:"failed",error_message:message,completed_at:new Date().toISOString()}).eq("id",backupId);return reply({ok:false,error:message},400)}
});
