// Authorized safety staff can verify registration numbers across GE ONE jobsites.
// Full orientation dossiers retain their existing project-scoped permissions.
const permittedStickerVerificationRoles=new Set(['admin','safety_director','safety']);
export const canVerifyStickerAcrossJobsites=role=>permittedStickerVerificationRoles.has(role);

export function renderGlobalStickerMatches(records,currentProjectId,localRecordFound,{tr,esc}){
 const all=Array.isArray(records)?records:[];
 const entries=all.filter(item=>item&&item.project_id&&(!localRecordFound||item.project_id!==currentProjectId));
 if(!entries.length)return '';
 const projectCount=new Set(all.map(item=>item?.project_id).filter(Boolean)).size;
 const crossProject=entries.some(item=>item.project_id!==currentProjectId);
 const heading=crossProject?tr('Sticker registered in another jobsite','Sticker registrado en otro jobsite'):tr('Sticker registration confirmed','Registro del sticker confirmado');
 const warning=projectCount>1?'<p class="orientation-global-warning" role="alert">'+tr('This number appears in multiple jobsites. Confirm the employee and jobsite before making a decision.','Este número aparece en varios jobsites. Confirme el trabajador y el proyecto antes de tomar una decisión.')+'</p>':'';
 return '<section class="card orientation-global-match" aria-label="'+tr('G&E sticker verification results','Resultados de verificación de stickers G&E')+'"><div class="orientation-valid">✓ '+heading+'</div><p>'+tr('Read-only verification for authorized G&E Safety staff. Full personal documents require jobsite access.','Verificación de solo lectura para personal Safety autorizado de G&E. Los documentos personales completos requieren acceso al jobsite.')+'</p>'+warning+'<div class="orientation-global-records">'+entries.map(item=>'<div class="orientation-global-record"><strong>'+esc(item.employee_name||'—')+'</strong><span>'+tr('Sticker','Sticker')+' #'+esc(item.sticker_number||'—')+'</span><small>'+tr('Jobsite','Proyecto')+': '+esc(item.project_name||'—')+'</small><small>'+tr('Trade / position','Oficio / puesto')+': '+esc(item.employee_trade||'—')+'</small><small>'+tr('Company','Compañía')+': '+esc(item.employee_company||'—')+'</small><small>'+esc(item.source_type==='quick'?tr('Quick Safety Orientation','Orientación Rápida'):tr('Safety Orientation','Orientación de Safety'))+'</small></div>').join('')+'</div></section>';
}
