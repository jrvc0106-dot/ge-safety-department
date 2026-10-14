import {createClient} from "npm:@supabase/supabase-js@2.57.0";

/** Admin-only PERMANENT Supabase deletion. Never invoked by ordinary Trash. */
const cors={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods":"POST, OPTIONS"
};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const sourceKinds={
 walk:{table:"daily_safety_walks",archive:["daily_safety_walk"]},
 discipline:{table:"safety_discipline",archive:["disciplinary_action"]},
 observation:{table:"observations",archive:["observation"]},
 correction:{table:"corrective_actions",archive:["correction"]},
 incident:{table:"incident_reports",archive:["incident","near_miss"]},
 equipment:{table:"equipment_inspections",archive:["equipment_inspection"]}
};
const bad=(message:string,status=400)=>new Response(JSON.stringify({error:message}),{status,headers:{...cors,"Content-Type":"application/json"}});
function check(result:{error?:{message:string}|null},label:string){
 if(result.error)throw new Error(label+": "+result.error.message);
}
function ownPath(path:unknown){
 const v=String(path||"");
 if(!v||v.startsWith("/")||v.includes("..")||v.length>900)return null;
 return v;
}
async function collectRows(admin:any,table:string,field:string,id:string){
 const {data,error}=await admin.from(table).select("path").eq(field,id).limit(1000);
 check({error},"Read evidence");return (data||[]).map((row:{path:string})=>row.path).filter(Boolean);
}
async function removeFiles(admin:any,files:Map<string,Set<string>>){
 let removed=0;
 for(const [bucket,values] of files){
  const paths=[...values];
  for(let i=0;i<paths.length;i+=100){
   // Storage API actually removes physical bytes; SQL DELETE storage.objects does not.
   const {error}=await admin.storage.from(bucket).remove(paths.slice(i,i+100));
   check({error},"Remove "+bucket+" file");
   removed+=Math.min(100,paths.length-i);
  }
 }
 return removed;
}
async function listOwnFolder(admin:any,bucket:string,folder:string){
 const paths:string[]=[];
 for(let offset=0;offset<10000;offset+=100){
  const {data,error}=await admin.storage.from(bucket).list(folder,{limit:100,offset});
  check({error},"List "+bucket+" evidence");
  if(!data?.length)break;
  for(const obj of data){
   // Only direct objects under this verified project + report folder.
   if(obj.name&&obj.id)paths.push(folder+"/"+obj.name);
  }
  if(data.length<100)break;
 }
 return paths;
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return bad("Method not allowed",405);
 try{
  const bearer=req.headers.get("Authorization")||"";
  if(!bearer.startsWith("Bearer "))return bad("Unauthorized",401);
  const url=Deno.env.get("SUPABASE_URL")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  if(!url||!service||!anon)throw Error("Secure server configuration missing");
  const opts={auth:{persistSession:false,autoRefreshToken:false}};
  const admin=createClient(url,service,opts);
  const {data:{user},error:authError}=await admin.auth.getUser(bearer.slice(7));
  if(authError||!user)return bad("Unauthorized",401);
  const {data:actor,error:profileError}=await admin.from("profiles").select("role,removed_at").eq("id",user.id).single();
  if(profileError||actor?.role!=="admin"||actor?.removed_at)return bad("Admin access required",403);

  const body=await req.json();
  const project=String(body?.project_id||""),kind=String(body?.report_kind||""),id=String(body?.report_id||"");
  if(!uuid.test(project)||!["daily","inventory","walk","discipline","correction","observation","incident","equipment","document"].includes(kind))
   return bad("Invalid report identity");
  if(!["daily","inventory"].includes(kind)&&!uuid.test(id))return bad("Invalid report ID");
  if(["daily","inventory"].includes(kind)&&!new RegExp("^"+kind+"-\\d{4}-\\d{2}-\\d{2}$").test(id))
   return bad("Invalid generated report date");

  // The record must already be in Admin Trash and must match the user's exact project.
  const {data:trash,error:trashError}=await admin.from("report_center_trash")
   .select("report_title,state").eq("project_id",project).eq("report_kind",kind).eq("report_id",id).single();
  if(trashError||trash?.state!=="trashed")return bad("Move this exact report to Admin Trash first",409);

  const sources:{table:string;id:string;projectColumn:boolean}[]=[];
  const files=new Map<string,Set<string>>();
  const add=(bucket:string,path:unknown)=>{
   const safe=ownPath(path);if(!safe)return;
   if(!files.has(bucket))files.set(bucket,new Set());
   files.get(bucket)!.add(safe);
  };
  let types:string[]=[];
  if(kind==="document"){
   const [quick,tool]=await Promise.all([
    admin.from("quick_safety_orientations").select("id,photo_paths,face_photo_path").eq("id",id).eq("project_id",project).maybeSingle(),
    admin.from("safety_tool_records").select("id,kind,photos").eq("id",id).eq("project_id",project).maybeSingle()
   ]);
   check(quick,"Quick orientation lookup");check(tool,"Safety tool lookup");
   if(quick.data&&tool.data)return bad("Ambiguous report identity",409);
   if(quick.data){
    const {data:links,error}=await admin.from("safety_discipline").select("id").eq("employee_quick_orientation_id",id).limit(1);
    check({error},"Disciplinary link check");
    if(links?.length)return bad("This orientation is linked to a disciplinary record. Delete that linked report first.",409);
    sources.push({table:"quick_safety_orientations",id,projectColumn:true});
    types=["training"];
    for(const p of quick.data.photo_paths||[])add("quick-orientation-photos",p);
    add("quick-orientation-photos",quick.data.face_photo_path);
   }else if(tool.data){
    if(["medical_followup","safety_notes"].includes(tool.data.kind))return bad("Protected personal or medical documents cannot be removed from Report Center",403);
    sources.push({table:"safety_tool_records",id,projectColumn:true});
    types=["tool_"+tool.data.kind];
    for(const p of tool.data.photos||[])add("safety-tool-evidence",p.path);
   }else{
    // Possible retry after storage/database deletion completed but audit update failed.
    // Only the already-trashed exact report ID reaches this branch.
    types=["training","tool_toolbox","tool_training","tool_safety_net","tool_emergency","tool_director","tool_qr"];
   }
  }else if(kind==="daily"||kind==="inventory"){
   // Aggregate report: delete its PDF archives, not unrelated live observations or inventory stock.
   types=kind==="daily"?["daily_report"]:["inventory"];
  }else{
   const mapping=sourceKinds[kind as keyof typeof sourceKinds];
   types=mapping.archive;
   const table=mapping.table;
   let record:any;
   if(kind==="correction"){
    const {data,error}=await admin.from("corrective_actions").select("id,observation_id").eq("id",id).maybeSingle();
    check({error},"Correction lookup");
    if(data){
     const {data:obs,error:oe}=await admin.from("observations").select("project_id").eq("id",data.observation_id).maybeSingle();
     check({error:oe},"Observation lookup");if(obs?.project_id!==project)return bad("Correction belongs to another project",403);
     record=data;
    }
   }else{
    const {data,error}=await admin.from(table).select("id").eq("id",id).eq("project_id",project).maybeSingle();
    check({error},"Source report lookup");record=data;
   }
   if(kind==="incident"){
    const {data,error}=await admin.from("employee_medical_followups").select("id").eq("incident_id",id).limit(1);
    check({error},"Medical follow-up check");if(data?.length)return bad("Incident has a linked medical follow-up; it cannot be deleted without a separate authorized review",409);
   }
   if(kind==="observation"){
    const {data,error}=await admin.from("corrective_actions").select("id").eq("observation_id",id).limit(1);
    check({error},"Correction link check");if(data?.length)return bad("Observation has corrective actions; remove those reports first",409);
   }
   if(record)sources.push({table,id,projectColumn:kind!=="correction"});
   if(kind==="walk")for(const p of await listOwnFolder(admin,"daily-safety-walks",project+"/"+id))add("daily-safety-walks",p);
   if(kind==="discipline")for(const p of await collectRows(admin,"discipline_photos","discipline_id",id))add("discipline-evidence",p);
   if(kind==="incident")for(const p of await collectRows(admin,"incident_report_photos","incident_id",id))add("incident-evidence",p);
   if(kind==="equipment")for(const p of await collectRows(admin,"equipment_inspection_photos","inspection_id",id))add("equipment-inspections",p);
   if(kind==="observation")for(const p of await collectRows(admin,"observation_photos","observation_id",id))add("observation-photos",p);
   void record;
  }

  // Select all versions of PDFs for the exact source record, never another project.
  let docsQuery=admin.from("report_documents").select("id,pdf_path,report_type,source_id,created_at")
    .eq("project_id",project).in("report_type",types);
  if(kind==="daily"||kind==="inventory"){
   const day=id.slice(kind.length+1).replaceAll("-","");
   // Report numbers use the jobsite's local report date, not UTC creation time.
   // Avoid leaving a midnight-offset PDF copy in Supabase.
   const prefix=kind==="daily"?"DSR-":"IV-";
   docsQuery=docsQuery.is("source_id",null).like("report_number",prefix+day+"-%");
  }else docsQuery=docsQuery.eq("source_id",id);
  const {data:docs,error:docsError}=await docsQuery.limit(500);
  check({error:docsError},"Archived PDF lookup");
  if((docs||[]).length>=500)throw Error("Report archive has too many versions for safe deletion");
  for(const doc of docs||[]){
   if(doc.pdf_path&&!String(doc.pdf_path).startsWith(project+"/"))
    throw Error("Unsafe archived PDF path; no files were deleted");
   add("final-reports",doc.pdf_path);
  }

  // Storage and database cannot be in one transaction. Retain Trash on any
  // failed step; retry is safe because removals are scoped and idempotent.
  const removedFiles=await removeFiles(admin,files);
  const documentIds=(docs||[]).map((d:{id:string})=>d.id);
  if(documentIds.length){
   const {error}=await admin.from("report_documents").delete().in("id",documentIds).eq("project_id",project);
   check({error},"Delete Supabase PDF metadata");
  }
  for(const source of sources){
   let q=admin.from(source.table).delete().eq("id",source.id);
   if(source.projectColumn)q=q.eq("project_id",project);
   const {data,error}=await q.select("id");
   check({error},"Delete source report");
   if(!data?.length)throw Error("Source report deletion was not verified");
  }
  // Set audit status using the caller JWT; DB trigger verifies role and fills actor id.
  const userClient=createClient(url,anon,{...opts,global:{headers:{Authorization:bearer}}});
  const {data:done,error:doneError}=await userClient.from("report_center_trash")
   .update({state:"permanent"}).eq("project_id",project).eq("report_kind",kind)
   .eq("report_id",id).eq("state","trashed")
   .select("project_id,report_kind,report_id,report_title,state,deleted_at,deleted_by").single();
  check({error:doneError},"Finish permanent removal audit");
  if(done?.state!=="permanent")throw Error("Permanent removal could not be verified");

  return Response.json({ok:true,entry:done,deleted_pdfs:documentIds.length,
   removed_storage_files:removedFiles,deleted_source_records:sources.length},{headers:cors});
 }catch(err){
  console.error("Report Center permanent removal failed",err instanceof Error?err.message:"unknown");
  return bad(err instanceof Error?err.message:"Permanent removal failed",500);
 }
});
