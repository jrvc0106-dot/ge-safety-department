export function employeeHiringMarkup(tr=(en)=>en){
 const url='https://ge-safety-department.vercel.app/apply.html';
 return '<section class="card employee-hiring"><header><small>G&E FLORIDA CONTRACTORS · HUMAN RESOURCES</small><h1>'+tr('Employee Application & Hiring','Solicitudes y contratación')+'</h1><p>'+tr('Scan the QR to open the mobile applicant demonstration.','Escanee el QR para abrir la demostración móvil.')+'</p></header>'+
 '<div style="display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));align-items:start">'+
 '<div style="padding:20px;border:1px solid #d3dce2;border-radius:14px;background:white;text-align:center"><div id="hiring-qr" style="min-height:220px;display:grid;place-items:center">QR</div><a href="'+url+'" target="_blank" rel="noopener noreferrer">Open mobile application / Abrir formulario</a><div style="margin-top:12px"><button type="button" id="hiring-download-qr">Download QR / Descargar QR</button></div></div>'+
 '<div class="hiring-status" role="status"><strong>'+tr('TEST MODE · no sensitive information','MODO PRUEBA · sin información sensible')+'</strong><p>'+tr('The QR opens a demonstration form. It does NOT submit documents to HR or Dropbox. Do not enter real identity, Social Security or tax information.','El QR abre un formulario de demostración. NO envía documentos a HR ni Dropbox. No introduzca identificación, Seguro Social ni datos fiscales reales.')+'</p><p>'+tr('The production intake will be enabled only after secure authentication, document storage and legal form requirements are verified.','La recepción real se habilitará cuando estén verificados el almacenamiento privado, los permisos y los formularios oficiales.')+'</p></div></div>'+
 '<button type="button" id="hiring-existing-settings" class="secondary" style="margin-top:20px">'+tr('Application settings','Configuración de la aplicación')+'</button></section>';
}
export async function mountHiringQR(){
 const host=document.querySelector('#hiring-qr');if(!host)return;
 try{
  const {default:QRCode}=await import('qrcode');
  const canvas=document.createElement('canvas');
  await QRCode.toCanvas(canvas,'https://ge-safety-department.vercel.app/apply.html',{width:300,margin:2,errorCorrectionLevel:'H',color:{dark:'#102c40',light:'#ffffff'}});
  canvas.style.cssText='width:min(100%,300px);height:auto;image-rendering:auto';host.replaceChildren(canvas);
  document.querySelector('#hiring-download-qr')?.addEventListener('click',()=>{
   const anchor=document.createElement('a');anchor.download='GE-Employee-Hiring-QR.png';anchor.href=canvas.toDataURL('image/png');anchor.click();
  });
 }catch(err){host.textContent='QR unavailable / QR no disponible';console.error('QR creation failed',err)}
}
