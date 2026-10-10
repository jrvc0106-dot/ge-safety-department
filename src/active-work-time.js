export function formatActiveTime(ms) {
  const seconds=Math.floor(Math.max(0,Number(ms)||0)/1000);
  if(seconds<60)return seconds+' s';
  const minutes=Math.floor(seconds/60);
  return minutes<60?minutes+' min':Math.floor(minutes/60)+' h '+(minutes%60)+' min';
}

export function createActiveClock({idleMs=120000,maxGapMs=15000}={}) {
  let previous=null,lastActivity=-Infinity;
  return ({now,context,visible,focused,interacted=false})=>{
    const valid=context?.userId&&context?.projectId;
    const key=valid?JSON.stringify([context.userId,context.projectId,context.device]):'';
    let duration=0;
    if(previous&&key&&previous.key===key&&previous.visible&&previous.focused&&visible&&focused){
      const gap=now-previous.now;
      if(gap>=0&&gap<=maxGapMs)duration=Math.max(0,Math.min(now,lastActivity+idleMs)-previous.now);
    }
    if(key!==previous?.key||interacted)lastActivity=now;
    previous={now,key,visible,focused};
    return duration>0?{context:{...context},duration}:null;
  };
}

export function installActiveWorkTime({db,getContext,window:win,document:doc}) {
  const storageKey='ge_active_work_pending_v1',clock=createActiveClock();
  let pending=[],accumulated=new Map(),sending=null;
  try{
    const saved=JSON.parse(win.sessionStorage.getItem(storageKey)||'null');
    if(saved){pending=Array.isArray(saved.pending)?saved.pending:[];accumulated=new Map(saved.accumulated||[])}
  }catch{}
  const persist=()=>{try{win.sessionStorage.setItem(storageKey,JSON.stringify({pending,accumulated:[...accumulated]}))}catch{}};
  const context=()=>{
    const value=getContext();if(!value?.userId||!value?.projectId)return null;
    const width=win.screen?.width||win.innerWidth||0;
    return {...value,device:width>=700&&width<=1400?'tablet':width<700?'phone':width>1400?'desktop':'other'};
  };
  const sample=(interacted=false)=>{
    const item=clock({now:win.performance.now(),context:context(),visible:doc.visibilityState==='visible',focused:doc.hasFocus(),interacted});
    if(!item)return;
    const key=JSON.stringify([item.context.userId,item.context.projectId,item.context.device]);
    const current=accumulated.get(key)||{context:item.context,duration:0};
    current.duration+=item.duration;accumulated.set(key,current);persist();
  };
  const seal=()=>{
    for(const {context:c,duration} of accumulated.values()){
      let remaining=Math.floor(duration);
      while(remaining>0){const value=Math.min(remaining,120000);pending.push({project_id:c.projectId,user_id:c.userId,device_category:c.device,session_id:win.crypto.randomUUID(),page:'active_app',metric:'active_time',metric_value:value});remaining-=value}
    }
    accumulated.clear();persist();
  };
  const flush=()=>{
    sample();seal();if(sending)return sending;
    const user=context()?.userId;if(!user)return Promise.resolve();
    const batch=pending.filter(row=>row.user_id===user).slice(0,100);if(!batch.length)return Promise.resolve();
    sending=(async()=>{
      try{
        const result=await db.from('app_performance_events').upsert(batch,{onConflict:'project_id,user_id,session_id,page,metric',ignoreDuplicates:true});
        if(result.error)return;
        const ids=new Set(batch.map(row=>row.session_id));pending=pending.filter(row=>!ids.has(row.session_id));persist();
      }catch{ /* Retain stable IDs for an idempotent retry after reconnection. */ }
      finally{sending=null}
    })();return sending;
  };
  const onInteraction=()=>sample(true),onVisibility=()=>{sample();void flush()},onOnline=()=>{void flush()};
  for(const name of ['pointerdown','keydown','touchstart','scroll'])doc.addEventListener(name,onInteraction,{passive:true,capture:true});
  doc.addEventListener('visibilitychange',onVisibility);
  for(const name of ['focus','blur','pagehide'])win.addEventListener(name,onVisibility);
  win.addEventListener('online',onOnline);
  sample();const sampleTimer=win.setInterval(sample,5000),flushTimer=win.setInterval(flush,30000);
  return {flush,stop(){win.clearInterval(sampleTimer);win.clearInterval(flushTimer);for(const name of ['pointerdown','keydown','touchstart','scroll'])doc.removeEventListener(name,onInteraction,true);doc.removeEventListener('visibilitychange',onVisibility);for(const name of ['focus','blur','pagehide'])win.removeEventListener(name,onVisibility);win.removeEventListener('online',onOnline);return flush()}};
}
