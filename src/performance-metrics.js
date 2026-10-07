const sessionKey='ge_perf_session_v1';
function sessionId(){try{let id=sessionStorage.getItem(sessionKey);if(!id){id=crypto.randomUUID();sessionStorage.setItem(sessionKey,id)}return id}catch{return crypto.randomUUID()}}
export async function recordPageLoad(db,{projectId,userId,page,duration}={}){
 if(!db||!projectId||!userId||!page||!Number.isFinite(duration)||duration<0)return;
 const width=globalThis.screen?.width||globalThis.innerWidth||0;
 const device=width>=700&&width<=1400?'tablet':width<700?'phone':width>1400?'desktop':'other';
 const value=Math.min(120000,Math.round(duration*10)/10);
 try{await db.from('app_performance_events').upsert({project_id:projectId,user_id:userId,session_id:sessionId(),page:String(page).slice(0,80),metric:'load',metric_value:value,device_category:device},{onConflict:'project_id,user_id,session_id,page,metric'})}catch{}
}
