import {HIRING_SOURCE_FIELDS,HIRING_EMPLOYER_FIELDS,HIRING_SIGNATURE_FIELDS} from './hiring-form-schema.js';
export function employeeHiringMarkup(tr=(en)=>en){
 const url='https://ge-safety-department.vercel.app/apply.html';
 return '<section class="card employee-hiring"><header><small>G&E FLORIDA CONTRACTORS · HUMAN RESOURCES</small><h1>'+tr('Employee Application & Hiring','Solicitudes y contratación')+'</h1><p>'+tr('Scan the QR to open the first-stage employment application.','Escanee el QR para abrir la solicitud laboral inicial.')+'</p></header>'+
 '<div style="display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));align-items:start">'+
 '<div style="padding:20px;border:1px solid #d3dce2;border-radius:14px;background:white;text-align:center"><div id="hiring-qr" style="min-height:220px;display:grid;place-items:center">QR</div><a href="'+url+'" target="_blank" rel="noopener noreferrer">Open mobile application / Abrir formulario</a><div style="margin-top:12px"><button type="button" id="hiring-download-qr">Download QR / Descargar QR</button></div></div>'+
 '<div class="hiring-status" role="status"><strong>'+tr('APPLICATION INTAKE · limited to basic details','RECEPCIÓN DE SOLICITUDES · datos básicos')+'</strong><p>'+tr('The QR opens a real first-stage application. Basic information is sent to the private HR inbox; official documents are not yet collected. Do not enter Social Security numbers, identity or tax information.','El QR abre una solicitud laboral inicial. Los datos básicos llegan a la bandeja privada de HR; los documentos oficiales aún no se reciben. No introduzca Seguro Social, identificaciones ni información fiscal.')+'</p><p>'+tr('Full onboarding will be enabled after secure document storage, signatures and legal form checks.','La contratación completa se habilitará tras verificar almacenamiento privado, firmas y formularios oficiales.')+'</p></div></div>'+
 '<p><a href="/hiring-57.html" target="_blank" rel="noopener">'+tr('Open 57-field onboarding form','Abrir formulario de 57 campos')+'</a></p>'+ 
 '<p><a href="/hiring-field-review.html" target="_blank" rel="noopener">'+tr('Review the eight-page field checklist','Revisar los campos de las ocho páginas')+'</a></p>'+ 
 '<section id="hiring-pdf-preview" style="margin-top:22px" hidden><h2>'+tr('Eight-page original PDF draft','Borrador PDF original de ocho páginas')+'</h2><p>'+tr('Fill the fields below and export an editable draft based on the approved eight-page PDF. This does not create legal signatures or a completed employee file.','Complete los campos y exporte un borrador basado en el PDF original aprobado. No crea firmas legales ni un expediente completo.')+'</p><div id="hiring-pdf-preview-fields"></div><button type="button" id="hiring-preview-download">'+tr('Generate original PDF draft','Generar borrador PDF original')+'</button><p id="hiring-preview-status" role="status"></p></section>'+ 
 '<section id="hiring-template-panel" style="margin-top:22px" hidden><h2>'+tr('Approved original PDF','PDF original aprobado')+'</h2><p>'+tr('Only the verified 8-page original may be stored. The uploaded master is never edited.','Solo se admite el original verificado de ocho páginas. El archivo maestro nunca se modifica.')+'</p><input type="file" id="hiring-master-upload" accept="application/pdf,.pdf" aria-label="Approved original PDF"><button type="button" id="hiring-master-submit" class="secondary">'+tr('Verify and store PDF','Verificar y guardar PDF')+'</button><p id="hiring-master-status" role="status"></p></section>'+ 
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

export async function mountHiringApplications(db,tr=(en)=>en,role=''){
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
    card.append(title,info,select);
    if(role==='admin'){
     const del=document.createElement('button');del.type='button';del.className='secondary';del.style.cssText='margin-top:10px;border:1px solid #a42424;color:#a42424';del.textContent=tr('Permanently Delete Application','Borrar solicitud definitivamente');
     del.onclick=async()=>{
      const approved=window.confirm(tr('Permanently delete the application for '+row.applicant_name+'? This cannot be undone.','¿Borrar definitivamente la solicitud de '+row.applicant_name+'? Esta acción no se puede deshacer.'));
      if(!approved)return;
      del.disabled=true;
      try{
       const response=await fetch('https://uubgrpdknxheflbkwkzf.supabase.co/functions/v1/employee-hiring-intake',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'delete',id:row.id})});
       const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Deletion failed');
       card.remove();message.textContent=tr('Application permanently deleted.','Solicitud eliminada definitivamente.');
      }catch(e){message.textContent=tr('Deletion failed: ','No se pudo borrar: ')+e.message;del.disabled=false}
     };
     card.append(del);
    }
    root.append(card);
   }
  }catch(e){message.textContent=tr('Unable to load applications: ','No se pudieron cargar solicitudes: ')+e.message}
 };
 document.querySelector('#hiring-refresh')?.addEventListener('click',load);await load();
}

export function mountHiringMaster(db,tr=(en)=>en,role=''){
 const panel=document.querySelector('#hiring-template-panel');
 if(!panel||role!=='admin')return;
 panel.hidden=false;
 const status=document.querySelector('#hiring-master-status'),button=document.querySelector('#hiring-master-submit'),input=document.querySelector('#hiring-master-upload');
 button?.addEventListener('click',async()=>{
  const file=input.files?.[0];
  if(!file)return status.textContent=tr('Choose the original PDF.','Seleccione el PDF original.');
  if(file.size>5242880||file.size<1000||file.type!=='application/pdf')return status.textContent=tr('Only PDF files under 5 MB are accepted.','Solo se aceptan PDF menores de 5 MB.');
  button.disabled=true;status.textContent=tr('Verifying original…','Verificando original…');
  try{
   const bytes=new Uint8Array(await file.arrayBuffer());
   const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
   const approved=new Set(['9d603d9dbcb1bb7bc426cb1846eac632375398ff2364812d4241445774333f6d','910b4504131a28d54d648a174568cc6f8312baf2d79b625c29eab788a76e5f0b']);
   if(!approved.has(sha))throw Error(tr('This PDF is not the approved original.','Este PDF no coincide con el original aprobado.'));
   const session=(await db.auth.getSession()).data.session;
   if(!session)throw Error(tr('Sign in required.','Inicie sesión.'));
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   const response=await fetch('https://uubgrpdknxheflbkwkzf.supabase.co/functions/v1/employee-hiring-intake',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({action:'upload_master',base64:btoa(binary)})});
   const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'Upload failed');
   status.textContent=tr('Verified PDF stored privately. SHA-256: ','PDF verificado y guardado en privado. SHA-256: ')+result.sha256;
  }catch(e){status.textContent=e.message||String(e)}finally{button.disabled=false}
 });
}

export function mountHiringPdfPreview(db,tr=(en)=>en,role=''){
 if(!['admin','safety_director'].includes(role))return;
 const section=document.querySelector('#hiring-pdf-preview'),root=document.querySelector('#hiring-pdf-preview-fields'),status=document.querySelector('#hiring-preview-status'),button=document.querySelector('#hiring-preview-download');
 if(!section||!root||!button)return;section.hidden=false;
 const controls={};
 for(const [page,names] of Object.entries(HIRING_SOURCE_FIELDS)){
  if(!names.length)continue;
  const group=document.createElement('details');group.style.cssText='border:1px solid #d8e0e7;border-radius:9px;padding:12px;margin:10px 0';
  const summary=document.createElement('summary');summary.textContent=tr('Page ','Página ')+page+' · '+names.length+tr(' fields',' campos');group.append(summary);
  for(const name of names){
   const label=document.createElement('label');label.style.cssText='display:block;margin:12px 0;font-size:13px';
   const strong=document.createElement('strong');strong.textContent=name.replaceAll('_',' ')+' · '+(HIRING_EMPLOYER_FIELDS.has(name)?'G&E':tr('Applicant','Solicitante'));
   label.append(strong);
   if(HIRING_SIGNATURE_FIELDS.has(name)){
    const p=document.createElement('small');p.style.cssText='display:block;color:#8b2a22';p.textContent=tr('Requires a separate valid e-signature; not generated by this draft.','Requiere firma electrónica válida por separado; este borrador no la genera.');label.append(p);
   }else{
    const input=document.createElement('input');input.type=/SSN|Birth_Date|DOB/.test(name)?'password':'text';input.autocomplete='off';input.maxLength=256;input.style.cssText='display:block;width:100%;padding:10px;box-sizing:border-box;margin-top:6px;border:1px solid #b0bdc7;border-radius:6px';
    input.placeholder=tr('Value for original PDF','Valor para PDF original');controls[name]=input;label.append(input);
   }
   group.append(label);
  }root.append(group);
 }
 button.onclick=async()=>{
  button.disabled=true;status.textContent=tr('Generating PDF from verified master…','Generando PDF desde original verificado…');
  try{
   const token=(await db.auth.getSession()).data.session?.access_token;if(!token)throw Error(tr('Sign in required.','Inicie sesión.'));
   const values={};for(const [key,input] of Object.entries(controls)){if(input.value.trim())values[key]=input.value.trim()}
   const response=await fetch('https://uubgrpdknxheflbkwkzf.supabase.co/functions/v1/employee-hiring-pdf-preview',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'preview',values})});
   if(!response.ok){const error=await response.json();throw Error(error.error||'PDF generation failed')}
   const blob=await response.blob();if(blob.type!=='application/pdf')throw Error('Invalid PDF response');
   const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='GE-Employee-Hiring-DRAFT.pdf';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),15000);
   status.textContent=tr('PDF draft generated. All eight original pages preserved; signatures are not included.','Borrador generado. Se conservaron las ocho páginas originales; no incluye firmas.');
  }catch(e){status.textContent=String(e.message||e)}finally{button.disabled=false}
 };
}
