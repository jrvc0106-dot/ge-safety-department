export function employeeHiringMarkup(tr=(en)=>en){
 const url='https://ge-safety-department.vercel.app/apply.html';
 return '<section class="card employee-hiring"><header><small>G&E FLORIDA CONTRACTORS · HUMAN RESOURCES</small><h1>'+tr('Employee Application & Hiring','Solicitudes y contratación')+'</h1><p>'+tr('Scan the QR to open the mobile applicant demonstration.','Escanee el QR para abrir la demostración móvil.')+'</p></header>'+
 '<div style="display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));align-items:start">'+
 '<div style="padding:20px;border:1px solid #d3dce2;border-radius:14px;background:white;text-align:center"><div id="hiring-qr" style="min-height:220px;display:grid;place-items:center">QR</div><a href="'+url+'" target="_blank" rel="noopener noreferrer">Open mobile application / Abrir formulario</a><div style="margin-top:12px"><button type="button" id="hiring-download-qr">Download QR / Descargar QR</button></div></div>'+
 '<div class="hiring-status" role="status"><strong>'+tr('TEST MODE · no sensitive information','MODO PRUEBA · sin información sensible')+'</strong><p>'+tr('The QR opens a demonstration form. It does NOT submit documents to HR or Dropbox. Do not enter real identity, Social Security or tax information.','El QR abre un formulario de demostración. NO envía documentos a HR ni Dropbox. No introduzca identificación, Seguro Social ni datos fiscales reales.')+'</p><p>'+tr('The production intake will be enabled only after secure authentication, document storage and legal form requirements are verified.','La recepción real se habilitará cuando estén verificados el almacenamiento privado, los permisos y los formularios oficiales.')+'</p></div></div>'+
 '<section style="margin-top:22px"><h2>'+tr('Received Applications','Solicitudes recibidas')+'</h2><p id="hiring-list-message" role="status">'+tr('Loading…','Cargando…')+'</p><div id="hiring-applications"></div><button id="hiring-refresh" type="button" class="secondary">'+tr('Refresh applications','Actualizar solicitudes')+'</button></section>'+ 
 '<button type="button" id="hiring-existing-settings" class="secondary" style="margin-top:20px">'+tr('Application settings','Configuración de la aplicación')+'</button></section>';
}
export function mountHiringQR(){
 const host=document.querySelector('#hiring-qr');if(!host)return;
 const url='https://ge-safety-department.vercel.app/apply.html';
 // Only the public application URL is sent to the QR service, no applicant data.
 const qr='https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data='+encodeURIComponent(url);
 const image=document.createElement('img');image.alt='Scan to open G&E Employee Hiring test form';image.width=300;image.height=300;image.style.cssText='width:min(100%,300px);height:auto';
 image.onload=()=>host.replaceChildren(image);
 image.onerror=()=>{host.textContent='QR unavailable. Open the application link below.'};
 image.src=qr;
 document.querySelector('#hiring-download-qr')?.addEventListener('click',()=>window.open(qr,'_blank','noopener'));
}

export async function mountHiringApplications(db,tr=(en)=>en){
 const root=document.querySelector('#hiring-applications'),message=document.querySelector('#hiring-list-message');if(!root||!message)return;
 const load=async()=>{
  message.textContent=tr('Loading applications…','Cargando solicitudes…');
  try{
   const token=(await db.auth.getSession()).data.session?.access_token;
   if(!token)throw Error('Session required');
   const response=await fetch('https://uubgrpdknxheflbkwkzf.supabase.co/functions/v1/employee-hiring-intake',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'list'})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to load');
   root.replaceChildren();message.textContent=(result.items||[]).length+' '+tr('applications','solicitudes');
   for(const row of result.items||[]){
    const card=document.createElement('article');card.style.cssText='border:1px solid #d4dde2;border-radius:9px;padding:13px;margin:10px 0;background:white';
    const title=document.createElement('strong');title.textContent=row.applicant_name+' · '+row.trade;
    const info=document.createElement('p');info.textContent=[row.contact_email,row.contact_phone,row.submission_id,new Date(row.created_at).toLocaleDateString()].filter(Boolean).join(' · ');
    const select=document.createElement('select');select.setAttribute('aria-label','Application status');
    for(const status of ['submitted','under_review','approved','not_selected','onboarding']){
     const option=document.createElement('option');option.value=status;option.textContent=status.replaceAll('_',' ');option.selected=row.status===status;select.append(option);
    }
    select.onchange=async()=>{select.disabled=true;try{const response=await fetch('https://uubgrpdknxheflbkwkzf.supabase.co/functions/v1/employee-hiring-intake',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'status',id:row.id,status:select.value})});if(!response.ok)throw Error((await response.json()).error||'Update failed');message.textContent=tr('Status updated.','Estado actualizado.')}catch(e){message.textContent=e.message;select.value=row.status}finally{select.disabled=false}};
    card.append(title,info,select);root.append(card);
   }
  }catch(e){message.textContent=tr('Unable to load applications: ','No se pudieron cargar solicitudes: ')+e.message}
 };
 document.querySelector('#hiring-refresh')?.addEventListener('click',load);await load();
}
