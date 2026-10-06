import {createClient} from '@supabase/supabase-js';
import {saveCloudToolbox} from '../server/toolbox-save.js';
export const config={maxDuration:60};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 const authorization=req.headers.authorization||'';
 if(!/^Bearer \S+$/i.test(authorization))return res.status(401).json({error:'Sign in again before saving.'});
 const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_ANON_KEY;
 if(!url||!key)return res.status(503).json({error:'Report saving is not configured.'});
 const db=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 try{
  const auth=await db.auth.getUser(authorization.slice(7));if(auth.error||!auth.data.user)return res.status(401).json({error:'Sign in again before saving.'});
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  const data=await saveCloudToolbox(db,auth.data.user,body);return res.status(200).json(data);
 }catch(error){const status=error.status||(/permission|row-level security/i.test(error.message||'')?403:503);return res.status(status).json({error:error.message||'Report saving could not be confirmed. Retry with your draft.'})}
}
