// G&E ONE: final PDF document for the full Register Safety Orientation flow.
// This is distinct from Quick Safety Orientation and deliberately does not invent
// hazards, attendance or approvals that were not recorded in this registration.
export function registeredSafetyOrientationReport(record,{tr,esc,fmt,project,photos={},signatureMarkup=''}) {
 const photo=(url,caption,key)=>url
  ?`<figure class="registered-orientation-evidence"><img src="${esc(url)}" alt="${esc(caption)}"><figcaption>${esc(caption)}</figcaption></figure>`
  :`<div class="registered-orientation-evidence-missing"><b>${esc(caption)}</b><span>${tr('Photo not available in this record','Foto no disponible en este registro')}</span></div>`;
 const additional=(Array.isArray(photos.certificates)?photos.certificates:[]).filter(Boolean);
 const number='SO-'+String(record.sticker_number||'').replace(/[^a-z0-9_-]/gi,'').toUpperCase();
 const item=(label,value)=>`<div><span>${label}</span><b>${esc(value||'—')}</b></div>`;
 const date=record.orientation_date?fmt(record.orientation_date):'—';
 return `<article class="report print-report professional-report registered-safety-orientation-report">
  <div class="print-report-watermark"><img src="/ge-logo.png" alt=""></div>
  <header class="registered-orientation-header">
   <img src="/ge-logo.png" alt="G&E Florida Contractors">
   <div><small>G&E FLORIDA CONTRACTORS · SAFETY DEPARTMENT</small><h1>${tr('Safety Orientation Report','Reporte de Orientación de Seguridad')}</h1><p>${tr('Register Safety Orientation · Final Record','Registro de Orientación de Safety · Reporte Final')}</p></div>
   <div class="print-report-number"><b>${esc(number)}</b><span>${tr('COMPLETED','COMPLETADO')}</span></div>
  </header>
  <section class="registered-orientation-section">
   <h2>${tr('Employee Information','Información del Empleado')}</h2>
   <div class="registered-orientation-identity">
    ${photos.face?photo(photos.face,tr('Employee Face ID','Identificación del Trabajador'),'face'):''}
    <div class="registered-orientation-details">
     ${item(tr('Employee Name','Nombre del Empleado'),record.employee_name)}
     ${item(tr('Sticker Number','Número del Sticker'),record.sticker_number)}
     ${item(tr('Company','Compañía'),record.employee_company)}
     ${item(tr('Position / Trade','Posición / Oficio'),record.employee_position)}
     ${item(tr('Project / Jobsite','Proyecto / Jobsite'),project?.name)}
     ${item(tr('General Contractor','Contratista General'),project?.general_contractor)}
     ${item(tr('Orientation Date','Fecha de Orientación'),date)}
    </div>
   </div>
  </section>
  <section class="registered-orientation-section">
   <h2>${tr('Registration Evidence','Evidencia del Registro')}</h2>
   <div class="registered-orientation-evidence-grid">
    ${photo(photos.sticker,tr('G&E Sticker Number Photo','Foto del Sticker G&E'),'sticker')}
    ${photos.document?photo(photos.document,tr('Orientation Document','Documento de Orientación'),'document'):''}
   </div>
   ${additional.length?`<h3>${tr('Training Certificates','Certificados de Capacitación')} · ${additional.length}</h3><div class="registered-orientation-evidence-grid">${additional.map((url,index)=>photo(url,tr('Certificate','Certificado')+' '+(index+1),'certificate')).join('')}</div>`:''}
  </section>
  ${record.notes?`<section class="registered-orientation-section"><h2>${tr('Orientation Notes','Notas de Orientación')}</h2><p class="registered-orientation-notes">${esc(record.notes)}</p></section>`:''}
  <section class="registered-orientation-section registered-orientation-signatures">
   <h2>${tr('Required Signatures','Firmas Requeridas')}</h2>
   ${signatureMarkup}
  </section>
  <footer class="registered-orientation-footer"><span>G&E SAFETY DEPARTMENT</span><b>${tr('Safety Today · A Safer Tomorrow','Seguridad hoy · Un mañana más seguro')}</b><span>${esc(number)}</span></footer>
 </article>`;
}
