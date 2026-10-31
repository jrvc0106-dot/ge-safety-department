// Applies only to newly generated PDFs. No historical report or approved layout is edited.
// The logo remains the original /ge-logo.png; do not crop, stretch or substitute it.
export function protectPdfReportEvidencePhotos(container){
 if(!container?.querySelectorAll)return 0;
 // The exporter passes only its temporary report clone, never the saved report.
 // Include future evidence figures while excluding identity avatars, logos and
 // rendered digital signatures, which have their own intentional styling.
 const selector=[
  'article.report figure img:not([data-signature-strokes])',
  'article.report .report-photos img',
  'article.report .ir-photos img',
  'article.report .report-photo-grid img',
  'article.report .inventory-report-table img',
  'article.report .inventory-evidence img',
  'article.report .quick-report-employee-photo img',
  'article.report .quick-report-photos img',
  'article.report .eq-photo-frame img',
  'article.report .ewr-photo-card img',
  'article.report .registered-orientation-evidence img'
 ].join(',');
 const photos=container.querySelectorAll(selector);
 for(const photo of photos){
  if(!photo.style?.setProperty||photo.getAttribute?.('src')?.includes('ge-logo.png'))continue;
  photo.style.setProperty('object-fit','contain','important');
  photo.style.setProperty('object-position','center','important');
  photo.style.setProperty('image-rendering','auto','important');
 }
 return photos.length;
}

export function protectPdfReportLogos(container,{photos=false}={}){
 if(photos)protectPdfReportEvidencePhotos(container);
 if(!container?.querySelectorAll)return 0;
 const logos=container.querySelectorAll('img[src*="ge-logo.png"]');
 for(const logo of logos){
  if(!logo.style?.setProperty)continue;
  logo.style.setProperty('object-fit','contain','important');
  logo.style.setProperty('object-position','center','important');
  logo.style.setProperty('aspect-ratio','auto','important');
  logo.style.setProperty('image-rendering','auto','important');
 }
 return logos.length;
}

// A nonempty Blob alone is not enough: refuse obviously truncated/invalid files.
// Both html2pdf and jsPDF produce a %PDF-version header and terminal %%EOF.
export async function isValidPdfBlob(blob){
 if(!blob||typeof blob.slice!=='function'||typeof blob.size!=='number'||blob.size<32)return false;
 try{
  const [header,tail]=await Promise.all([blob.slice(0,8).text(),blob.slice(-2048).text()]);
  return /^%PDF-[0-9]\.[0-9]/.test(header)&&/%%EOF\s*$/.test(tail);
 }catch{return false}
}


// Run only against the disposable export clone. Never silently omit broken
// evidence: the caller must keep the saved report available for another try.
// Decode concurrently so a report with six images does not wait serially.
export async function validatePdfEvidenceImages(container){
 if(!container?.querySelectorAll)return 0;
 const selectors=[
  'article.report:not(.quick-safety-orientation-report) .report-photos img',
  'article.report:not(.quick-safety-orientation-report) .ir-photos img',
  'article.report:not(.quick-safety-orientation-report) .report-photo-grid img',
  'article.report:not(.quick-safety-orientation-report) .dr-photo-grid img',
  'article.report:not(.quick-safety-orientation-report) .inventory-evidence img',
  'article.report:not(.quick-safety-orientation-report) .eq-photo-frame img',
  'article.report:not(.quick-safety-orientation-report) .ewr-photo-card img',
  'article.report:not(.quick-safety-orientation-report) .registered-orientation-evidence img'
 ].join(',');
 const images=[...container.querySelectorAll(selectors)].filter(image=>
  image.getAttribute?.('src')&&!image.getAttribute('src').includes('ge-logo.png'));
 await Promise.all(images.map(async image=>{
  try{
   if(typeof image.decode==='function')await image.decode();
   else if(image.complete===false)await new Promise((resolve,reject)=>{
    let settled=false;
    const finish=error=>{
     if(settled)return;
     settled=true;clearTimeout(timer);
     image.removeEventListener('load',onLoad);
     image.removeEventListener('error',onError);
     error?reject(error):resolve();
    };
    const onLoad=()=>finish();
    const onError=()=>finish(new Error('Image loading failed'));
    const timer=setTimeout(()=>finish(new Error('Image loading timed out')),12000);
    image.addEventListener('load',onLoad);
    image.addEventListener('error',onError);
    if(image.complete)finish(image.naturalWidth?null:new Error('Image loading failed'));
   });
   if(image.naturalWidth===0||image.naturalHeight===0)
    throw new Error('Image has no decoded dimensions');
  }catch{
   throw new Error('PDF evidence image could not be loaded. Please retry the export.');
  }
 }));
 return images.length;
}
