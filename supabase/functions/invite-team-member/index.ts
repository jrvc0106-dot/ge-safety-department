import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return Response.json({error:"Unauthorized"},{status:401,headers:cors});
  const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userErr}=await admin.auth.getUser(auth.slice(7));if(userErr||!user)return Response.json({error:"Unauthorized"},{status:401,headers:cors});
  const {data:caller}=await admin.from("profiles").select("role,removed_at").eq("id",user.id).single();if(caller?.role!=="admin"||caller.removed_at)return Response.json({error:"Admin access required"},{status:403,headers:cors});
  const {email,name,role,project_id,redirect_to}=await req.json(),cleanEmail=String(email||"").trim().toLowerCase(),cleanName=String(name||"").trim(),allowed=["safety_director","safety","supervisor","worker"];
  if(cleanEmail.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail))return Response.json({error:"A valid email address is required"},{status:400,headers:cors});
  if(!cleanName||cleanName.length>120)return Response.json({error:"A valid name is required"},{status:400,headers:cors});
  if(!allowed.includes(role)||!project_id)return Response.json({error:"Role and project are required"},{status:400,headers:cors});
  const {data:project,error:projectError}=await admin.from("projects").select("id").eq("id",project_id).maybeSingle();if(projectError)throw projectError;if(!project)return Response.json({error:"Authorized project was not found"},{status:400,headers:cors});
  let uid:string|undefined,existing=false,profileExists=false,found,inviteLink:string|undefined;
  for(let page=1;!found;page++){
   const {data:list,error:listErr}=await admin.auth.admin.listUsers({page,perPage:1000});if(listErr)throw listErr;
   found=list.users.find(u=>u.email?.toLowerCase()===cleanEmail);if(list.users.length<1000)break;
  }
  if(found){
   const {data:oldProfile,error:oldError}=await admin.from("profiles").select("role,removed_at").eq("id",found.id).maybeSingle();if(oldError)throw oldError;
   if(oldProfile?.role==="admin")throw Error("Administrator accounts cannot be changed through team invitations");
   if(oldProfile?.removed_at){const {error:cleanupError}=await admin.auth.admin.deleteUser(found.id,true);if(cleanupError)throw cleanupError;found=undefined}
   else{profileExists=!!oldProfile;existing=true}
  }
  let safeRedirect:string|undefined;
  if(redirect_to){try{const parsed=new URL(String(redirect_to));if(["https:","http:"].includes(parsed.protocol)&&!parsed.username&&!parsed.password)safeRedirect=parsed.origin}catch{}}
  if(!found){
   const {data:generated,error:generateError}=await admin.auth.admin.generateLink({type:"invite",email:cleanEmail,options:{data:{name:cleanName},redirectTo:safeRedirect}});
   if(generateError)throw generateError;
   uid=generated.user?.id;inviteLink=generated.properties?.action_link;
   if(!inviteLink)throw new Error("The secure invitation link could not be generated");
  }else{
   uid=found.id;
   if(!found.email_confirmed_at){
    const {data:generated,error:generateError}=await admin.auth.admin.generateLink({type:"magiclink",email:cleanEmail,options:{redirectTo:safeRedirect}});
    if(generateError)throw generateError;
    inviteLink=generated.properties?.action_link;
    if(!inviteLink)throw new Error("The secure invitation link could not be generated");
   }
  }
  if(!uid)throw new Error("Team member account was not available");
  if(!profileExists||!found?.email_confirmed_at){const {error:pErr}=await admin.from("profiles").upsert({id:uid,email:cleanEmail,name:cleanName,role},{onConflict:"id"});if(pErr)throw pErr;}
  const {error:mErr}=await admin.from("project_members").upsert({project_id,user_id:uid},{onConflict:"project_id,user_id"});if(mErr)throw mErr;
  return Response.json({ok:true,email:cleanEmail,existing,action:inviteLink?"invitation_link_created":"project_access_added",invite_link:inviteLink},{headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:String(e),code:(e as {code?:string})?.code},{status:400,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}})}
});
