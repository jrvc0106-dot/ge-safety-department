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
