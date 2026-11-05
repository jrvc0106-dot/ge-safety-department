export function employeeHiringMarkup(tr=(en)=>en){
 const url='https://ge-safety-department.vercel.app/apply.html';
 return '<section class="card employee-hiring"><header><small>G&E FLORIDA CONTRACTORS · HUMAN RESOURCES</small><h1>'+tr('Employee Application & Hiring','Solicitudes y contratación')+'</h1><p>'+tr('Scan the QR to open the mobile applicant demonstration.','Escanee el QR para abrir la demostración móvil.')+'</p></header>'+
 '<div style="display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));align-items:start">'+
 '<div style="padding:20px;border:1px solid #d3dce2;border-radius:14px;background:white;text-align:center"><div id="hiring-qr" style="min-height:220px;display:grid;place-items:center">QR</div><a href="'+url+'" target="_blank" rel="noopener noreferrer">Open mobile application / Abrir formulario</a><div style="margin-top:12px"><button type="button" id="hiring-download-qr">Download QR / Descargar QR</button></div></div>'+
 '<div class="hiring-status" role="status"><strong>'+tr('TEST MODE · no sensitive information','MODO PRUEBA · sin información sensible')+'</strong><p>'+tr('The QR opens a demonstration form. It does NOT submit documents to HR or Dropbox. Do not enter real identity, Social Security or tax information.','El QR abre un formulario de demostración. NO envía documentos a HR ni Dropbox. No introduzca identificación, Seguro Social ni datos fiscales reales.')+'</p><p>'+tr('The production intake will be enabled only after secure authentication, document storage and legal form requirements are verified.','La recepción real se habilitará cuando estén verificados el almacenamiento privado, los permisos y los formularios oficiales.')+'</p></div></div>'+
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
