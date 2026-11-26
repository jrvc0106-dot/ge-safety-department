// Shared by all final reports. Modules may opt in to preparing their PDF on open.
export function attachJhaPdfActions(actions,report,{run,warm,isCurrent,scheduleIdle,nextTurn,progressText,prepare,statusText}){
 // Report previews should complete from the original tap. runPdfAction reserves the
 // Safari preview window synchronously, then fills it as soon as rendering ends.
 report.dataset.pdfViewMode='single-click';
 const buttons=['view','download','share','save'].map(action=>({action,button:actions.querySelector('.pdf-'+action)})).filter(item=>item.button);
 let busy=false,warming;
 const preload=()=>{
  if(!isCurrent())return;
  if(!warming)warming=Promise.resolve().then(warm).catch(()=>{warming=null});
  return warming;
 };
 if(prepare){
  const status=actions.ownerDocument.createElement('p');
  status.className='pdf-preparation-status';
  status.setAttribute('role','status');
  actions.after(status);
  const initial=buttons.map(({button})=>button.disabled);
  buttons.forEach(({button})=>{button.disabled=true});
  status.textContent=statusText.preparing;
  scheduleIdle(async()=>{
   if(!isCurrent())return;
   report.jhaPdfProgress=async(page,total)=>{
    if(isCurrent())status.textContent=progressText(page,total);
    await nextTurn();
   };
   try{
    await prepare();
    if(isCurrent())status.textContent=statusText.ready;
   }catch{
    if(isCurrent())status.textContent=statusText.retry;
   }finally{
    delete report.jhaPdfProgress;
    buttons.forEach(({button},index)=>{button.disabled=initial[index]});
   }
  });
 }else scheduleIdle(preload);
 for(const {action,button} of buttons){
  button.addEventListener('pointerenter',preload,{passive:true});
  button.addEventListener('pointerdown',preload,{passive:true});
  button.addEventListener('touchstart',preload,{passive:true});
  button.addEventListener('focus',preload);
  button.onclick=async event=>{
   if(busy||button.disabled||!isCurrent())return;
   busy=true;
   const disabled=buttons.map(item=>item.button.disabled),previousProgress=report.jhaPdfProgress;
   buttons.forEach(item=>item.button.disabled=true);
   report.jhaPdfProgress=async(page,total)=>{
    if(isCurrent())button.textContent=progressText(page,total);
    await nextTurn();
   };
   try{
    // Invoke synchronously in the click: Safari's native sharing and popup
    // permission must retain the original user activation.
    await run(action,event.currentTarget);
   }finally{
    if(previousProgress)report.jhaPdfProgress=previousProgress;else delete report.jhaPdfProgress;
    buttons.forEach((item,index)=>item.button.disabled=disabled[index]);busy=false;
   }
  };
 }
}
