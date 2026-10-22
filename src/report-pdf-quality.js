// Applies only to newly generated PDFs. No historical report or approved layout is edited.
// The logo remains the original /ge-logo.png; do not crop, stretch or substitute it.
export function protectPdfReportLogos(container){
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
