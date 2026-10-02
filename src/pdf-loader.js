export function createPdfLoader(importer){
 let pending;
 return ()=>{
  if(!pending)pending=Promise.resolve().then(importer).catch(error=>{pending=null;throw error});
  return pending;
 };
}
