import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return Response.json({error:"Unauthorized"},{status:401,headers:cors});
  const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userErr}=await admin.auth.getUser(auth.slice(7));if(userErr||!user)return Response.json({error:"Unauthorized"},{status:401,headers:cors});
  const {data:caller}=await admin.from("profiles").select("role").eq("id",user.id).single();if(caller?.role!=="admin")return Response.json({error:"Admin access required"},{status:403,headers:cors});
  const {email,name,role,project_id,redirect_to}=await req.json(),cleanEmail=String(email||"").trim().toLowerCase(),cleanName=String(name||"").trim(),allowed=["safety_director","safety","supervisor","worker"];
  if(!cleanEmail.endsWith("@geflcontractors.com"))return Response.json({error:"Only @geflcontractors.com emails are allowed"},{status:400,headers:cors});
  if(!allowed.includes(role)||!project_id)return Response.json({error:"Role and project are required"},{status:400,headers:cors});
  const {data:project}=await admin.from("projects").select("id").eq("id",project_id).maybeSingle();if(!project)return Response.json({error:"Authorized project was not found"},{status:400,headers:cors});
  const {data:list,error:listErr}=await admin.auth.admin.listUsers({page:1,perPage:1000});if(listErr)throw listErr;let uid:string|undefined,existing=false;const found=list.users.find(u=>u.email?.toLowerCase()===cleanEmail);
  if(found){uid=found.id;existing=true}else{let safeRedirect:string|undefined;if(redirect_to){try{const parsed=new URL(String(redirect_to));if(["https:","http:"].includes(parsed.protocol)&&!parsed.username&&!parsed.password)safeRedirect=parsed.origin}catch{}}const {data:inv,error}=await admin.auth.admin.inviteUserByEmail(cleanEmail,{data:{name:cleanName},redirectTo:safeRedirect});if(error)throw error;uid=inv.user?.id}
  if(!uid)throw new Error("Team member account was not available");
  const {error:pErr}=await admin.from("profiles").upsert({id:uid,email:cleanEmail,name:cleanName||cleanEmail.split("@")[0],role},{onConflict:"id"});if(pErr)throw pErr;
  const {error:mErr}=await admin.from("project_members").upsert({project_id,user_id:uid},{onConflict:"project_id,user_id"});if(mErr)throw mErr;
  return Response.json({ok:true,email:cleanEmail,existing,action:existing?"project_access_added":"invitation_sent"},{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:String(e)},{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});