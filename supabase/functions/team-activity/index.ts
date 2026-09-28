import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization");if(!auth)throw new Error("Unauthorized");
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user}}=await caller.auth.getUser();if(!user)throw new Error("Unauthorized");
  const admin=createClient(url,service);const {data:profile}=await admin.from("profiles").select("role").eq("id",user.id).single();
  if(profile?.role!=="admin")return new Response(JSON.stringify({error:"Admin access required"}),{status:403,headers:{...cors,"Content-Type":"application/json"}});
  const {data:profiles,error:pe}=await admin.from("profiles").select("id,email,name,role,position").order("name");if(pe)throw pe;
  const {data:{users},error:ue}=await admin.auth.admin.listUsers({page:1,perPage:1000});if(ue)throw ue;
  const [obs,corr,walks,disc,members,presence]=await Promise.all([admin.from("observations").select("created_by,created_at"),admin.from("corrective_actions").select("created_by,created_at"),admin.from("daily_safety_walks").select("created_by,created_at"),admin.from("safety_discipline").select("created_by,created_at"),admin.from("project_members").select("user_id,project_id,project:projects(name)"),admin.from("user_app_presence").select("user_id,last_seen_at,latitude,longitude,location_accuracy_m,location_updated_at")]);
  const activity=(id:string)=>{const sets=[["observations",obs.data||[]],["corrections",corr.data||[]],["daily_reports",walks.data||[]],["disciplinary_actions",disc.data||[]]] as const;let latest:string|null=null;const counts:any={};for(const [key,rows] of sets){const mine=rows.filter((x:any)=>x.created_by===id);counts[key]=mine.length;for(const x of mine)if(!latest||x.created_at>latest)latest=x.created_at}return {...counts,last_action_at:latest,total_actions:Object.values(counts).reduce((a:any,b:any)=>a+b,0)}};
  const result=(profiles||[]).map((p:any)=>{const u=users.find(x=>x.id===p.id),pr=(presence.data||[]).find((x:any)=>x.user_id===p.id),projects=(members.data||[]).filter((m:any)=>m.user_id===p.id).map((m:any)=>({id:m.project_id,name:m.project?.name||"Project"})),active_now=!!pr&&Date.now()-new Date(pr.last_seen_at).getTime()<120000;return {...p,active_now,last_app_activity_at:pr?.last_seen_at||null,location:pr?.latitude!=null&&pr?.longitude!=null?{latitude:pr.latitude,longitude:pr.longitude,accuracy_m:pr.location_accuracy_m,updated_at:pr.location_updated_at}:null,auth_status:u?.confirmed_at?"active":u?.invited_at?"invited":"pending",invited_at:u?.invited_at||null,accepted_at:u?.confirmed_at||null,last_sign_in_at:u?.last_sign_in_at||null,projects,activity:activity(p.id)}});
  return new Response(JSON.stringify({members:result}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});