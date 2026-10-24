/**
 * User-chosen PDF destination: iOS/Android use the native file share sheet
 * (Files / Save to Files); desktop Chromium uses showSaveFilePicker.
 * Browsers without either fall back to a normal download, whose folder is
 * controlled by the browser's Downloads settings.
 *
 * Never writes into app data or changes/renames the original cloud/local PDF.
 */
export function pdfSafeFilename(filename){
  const base=String(filename||'GE-ONE-Report.pdf')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'-')
    .replace(/^[.\s]+|[.\s]+$/g,'')
    .slice(0,145);
  return (/\.pdf$/i.test(base)?base:base+'.pdf')||'GE-ONE-Report.pdf';
}

// Must be called synchronously inside the click, before any network/render await.
// Resolve errors immediately to prevent an unhandled rejected picker promise.
export function reservePdfDestination(filename,{win=globalThis.window}={}){
  if(typeof win?.showSaveFilePicker!=='function')return {kind:'system'};
  let result;
  try{
    result=Promise.resolve(win.showSaveFilePicker({
      suggestedName:pdfSafeFilename(filename),
      types:[{description:'PDF Document',accept:{'application/pdf':['.pdf']}}]
    })).then(handle=>({handle}),error=>({error}));
  }catch(error){result=Promise.resolve({error})}
  return {kind:'picker',result};
}

export function fileShareSupported(blob,filename,{nav=globalThis.navigator,FileClass=globalThis.File}={}){
  if(typeof nav?.share!=='function'||typeof FileClass!=='function')return false;
  try{
    const file=new FileClass([blob],pdfSafeFilename(filename),{type:'application/pdf'});
    return typeof nav.canShare==='function'&&nav.canShare({files:[file]});
  }catch{return false}
}

export async function savePdfToDevice(blob,filename,{
 destination={kind:'system'},win=globalThis.window,nav=globalThis.navigator,
 doc=globalThis.document,FileClass=globalThis.File,
 download=()=>{throw Error('Download handler unavailable')}
}={}){
 if(!(blob?.size>=32)||blob?.type&&blob.type!=='application/pdf')
   throw Error('The PDF is incomplete and cannot be saved.');
 const name=pdfSafeFilename(filename);
 if(destination.kind==='picker'){
   const {handle,error}=await destination.result;
   if(error)throw error;
   if(!handle?.createWritable)throw Error('The selected folder is not writable.');
   const writer=await handle.createWritable();
   try{await writer.write(blob);await writer.close()}
   catch(err){try{await writer.abort?.()}catch{}throw err}
   return {kind:'saved',filename:name};
 }
 // A prepared File must be shared directly inside a real user click. iOS
 // allows "Save to Files" and lets the user select On My iPad or iCloud Drive.
 if(fileShareSupported(blob,name,{nav,FileClass})){
   const file=new FileClass([blob],name,{type:'application/pdf'});
   await nav.share({title:name,files:[file]});
   return {kind:'shared',filename:name};
 }
 download(blob,name);
 return {kind:'download',filename:name};
}
