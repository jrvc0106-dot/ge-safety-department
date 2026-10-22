// Load evidence linked to a full Safety Orientation with one retry for short
// Safari/Supabase network interruptions. Keep the original image references.
// This helper never invents, replaces, removes or exposes employee photographs.
export async function loadRegisteredOrientationEvidence(record,{
  fetchImage,
  tr=(en)=>en,
  delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
}={}){
 if(typeof fetchImage!=='function')throw new Error('Orientation photo loader unavailable');
 const certificates=Array.isArray(record?.certificate_photo_paths)?record.certificate_photo_paths.filter(Boolean):[];
 const entries=[
  {kind:'face',path:record?.orientation_photo_path,label:tr('Employee Face ID','Foto del rostro')},
  {kind:'sticker',path:record?.sticker_photo_path,label:tr('Sticker Number Photo','Foto del sticker')},
  {kind:'document',path:record?.orientation_document_photo_path,label:tr('Orientation Document','Documento de orientación')},
  ...certificates.map((path,i)=>({kind:'certificate',path,label:tr('Certificate','Certificado')+' '+(i+1)}))
 ];
 const urls=await Promise.all(entries.map(async({path,label})=>{
  if(!path)return '';
  for(let attempt=0;attempt<2;attempt++){
   try{
    const url=await fetchImage(path);
    if(url)return url;
   }catch{/* A transient download failure gets a single retry. */}
   if(attempt===0)await delay(250);
  }
  throw new Error(tr('Unable to load orientation evidence','No se pudo cargar la evidencia de orientación')+': '+label+'. '+tr('Check your connection and reopen the report.','Revise la conexión y vuelva a abrir el reporte.'));
 }));
 const [face,sticker,document,...certificateUrls]=urls;
 return {face,sticker,document,certificates:certificateUrls};
}
