import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers:cors});
 try{
  const token=req.headers.get('Authorization');
  if(!token?.startsWith('Bearer '))return Response.json({error:'Unauthorized'},{status:401,headers:cors});
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(token.slice(7));
  if(authError||!user)return Response.json({error:'Unauthorized'},{status:401,headers:cors});
  const {data:actor}=await admin.from('profiles').select('role,removed_at').eq('id',user.id).single();
  if(actor?.role!=='admin'||actor.removed_at)return Response.json({error:'Admin access required'},{status:403,headers:cors});
  const {user_id}=await req.json();
  if(typeof user_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id))throw Error('Valid member ID required');
  const {error:removeError}=await admin.rpc('remove_team_member',{p_actor:user.id,p_member:user_id});
  if(removeError)throw removeError;
  // Irreversible Auth soft deletion preserves foreign keys in historical reports.
  const {error:deleteError}=await admin.auth.admin.deleteUser(user_id,true);
  if(deleteError)throw Error('Team access removed. Account cleanup must be retried: '+deleteError.message);
  return Response.json({ok:true,action:'member_removed'},{headers:cors});
 }catch(error){return Response.json({error:error instanceof Error?error.message:String(error)},{status:400,headers:cors});}
});
