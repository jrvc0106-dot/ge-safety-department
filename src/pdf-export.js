import html2canvas from 'html2canvas';
import {jsPDF} from 'jspdf';
import {alignCriticalReportPdfBlocks,alignGeneralReportPdfEvidence} from './report-pdf-page-alignment.js';
import {applyAdaptiveReportPdfLayout,deviceKindFromWindow} from './report-device-pdf.js';

// 200 DPI keeps text, signatures and photos clear while holding each letter page
// below the app's 4 MP canvas budget on iPads. JPEG avoids huge lossless PDFs.
const pdfRenderScale=200/96;
// A JHA produced by html2pdf can begin with an all-white raster slice when
// its report starts after a CSS page-break/overlay offset. Inspect only the
// first page with a tiny downscaled raster, never the full-size iPad canvas.
// This does not alter pages containing text, logos, signatures or evidence.
export function pdfCanvasPageIsBlank(canvas,{documentRef=globalThis.document}={}){
 if(!canvas?.width||!canvas?.height||!documentRef?.createElement)return false;
 let sample;
 try{
  sample=documentRef.createElement('canvas');
  // Sample four times as many pixels as the old 64x80 scan: tiny PDF
  // lettering no longer disappears into antialiasing during downscaling.
  sample.width=128;sample.height=160;
  const context=sample.getContext?.('2d',{willReadFrequently:true});
  if(!context?.drawImage||!context?.getImageData)return false;
  context.drawImage(canvas,0,0,sample.width,sample.height);
  const data=context.getImageData(0,0,sample.width,sample.height).data;
  let ink=0,headerInk=0;
  for(let y=2;y<sample.height-2;y++)for(let x=3;x<sample.width-3;x++){
   const i=(y*sample.width+x)*4;
   const alpha=data[i+3]/255;
   // Ignore faint watermark and nearly-white page-border artifacts, but
   // preserve actual dark text and logos at the start of the JHA.
   if(alpha>.15&&Math.min(data[i],data[i+1],data[i+2])<205){
    ink++;
    if(y<sample.height*.35)headerInk++;
   }
  }
  // Only the first JHA raster may be dropped. A real cover has an inked
  // heading in its upper third; a false blank has none or only a faint logo.
  return ink<26||(headerInk<9&&ink<280);
 }catch{return false}
 finally{if(sample){sample.width=0;sample.height=0}}
}

// Only the non-Quick high-quality Letter exporter uses this decision.
// Text-only sheets are stored losslessly so small lettering, signatures and
// the G&E logo are not blurred by JPEG compression. Evidence photo sheets stay
// JPEG for reasonable storage and sharing sizes on iPad/mobile.
// Conservative blank-page check for OTHER report PDFs. A near-white page
// is retained whenever a single sampled pixel contains visible ink, a logo,
// a signature or photograph. A failed/unavailable canvas scan retains the page.
// This is separate from the legacy JHA first-page blank detection and the
// completely independent Quick Safety Orientation renderer.
export function pdfCanvasPageIsTrulyEmpty(canvas,{documentRef=globalThis.document}={}){
 if(!canvas?.width||!canvas?.height||!documentRef?.createElement)return false;
 let sample;
 try{
  sample=documentRef.createElement('canvas');
  sample.width=256;sample.height=320;
  const ctx=sample.getContext?.('2d',{willReadFrequently:true});
  if(!ctx?.drawImage||!ctx?.getImageData)return false;
  ctx.drawImage(canvas,0,0,sample.width,sample.height);
  const pixels=ctx.getImageData(0,0,sample.width,sample.height).data;
  if(!pixels||pixels.length!==sample.width*sample.height*4)return false;
  for(let i=0;i<pixels.length;i+=4){
   // Transparent white is blank. Conservative threshold preserves pale text.
   if(pixels[i+3]>12&&(pixels[i]<250||pixels[i+1]<250||pixels[i+2]<250))return false;
  }
  return true;
 }catch{return false}
 finally{if(sample){sample.width=0;sample.height=0}}
}

const evidencePhotoSelector=
 'figure img:not([data-signature-strokes]),.report-photos img,.ir-photos img,.report-photo-grid img,'+
 '.dr-photo-grid img,.inventory-evidence img,.registered-orientation-evidence img,'+
 '.eq-photo-frame img,.ewr-photo-card img';

// The final PDF clone is already laid out and aligned at this point. Read
// evidence image positions once instead of repeating layout work on every page.
// If layout cannot be measured, the original page raster behavior is retained.
export function indexPdfEvidencePositions(container){
 const report=container?.querySelector?.('article.report:not(.quick-safety-orientation-report)');
 if(!report)return null;
 const root=container.getBoundingClientRect?.();
 if(!root||!Number.isFinite(root.top))return null;
 const positions=[];
 for(const img of report.querySelectorAll(evidencePhotoSelector)){
  if(img.getAttribute?.('src')?.includes('ge-logo.png'))continue;
  const box=img.getBoundingClientRect?.();
  if(!box||!Number.isFinite(box.top)||!Number.isFinite(box.bottom))continue;
  positions.push([box.top-root.top+(container.scrollTop||0),
   box.bottom-root.top+(container.scrollTop||0)]);
 }
 return positions;
}
export function pdfPageRasterChoice(container,top,height,evidencePositions){
 const positions=Array.isArray(evidencePositions)?evidencePositions:indexPdfEvidencePositions(container);
 if(positions===null)return {format:'JPEG',mime:'image/jpeg',quality:0.92};
 for(const [y,end] of positions){
  if(end>top+1&&y<top+height-1)
   return {format:'JPEG',mime:'image/jpeg',quality:0.96};
 }
 return {format:'PNG',mime:'image/png'};
}

// Non-Quick reports keep their approved two-column PHOTO layout on iPhones,
// iPads and desktops. The stylesheet lives only in html2pdf's temporary clone.
export function stabilizeNonQuickPdfColumns(container){
 const report=container?.querySelector?.('article.report:not(.ge-reference-jha):not(.equipment-pdf):not(.quick-safety-orientation-report)');
 if(!report)return false;
 const doc=container.ownerDocument||report.ownerDocument;
 if(!doc?.createElement||!container.appendChild)return false;
 if(container.querySelector('[data-ge-nonquick-pdf-columns]'))return true;
 const style=doc.createElement('style');
 style.setAttribute('data-ge-nonquick-pdf-columns','');
 style.textContent=[
  'article.report:not(.quick-safety-orientation-report) .report-photos,',
  'article.report:not(.quick-safety-orientation-report) .ir-photos,',
  'article.report:not(.quick-safety-orientation-report) .report-photo-grid,',
  'article.report:not(.quick-safety-orientation-report) .dr-photo-grid,',
  'article.report:not(.quick-safety-orientation-report) .registered-orientation-evidence-grid',
  '{grid-template-columns:repeat(2,minmax(0,1fr))!important;}',
  'article.report:not(.quick-safety-orientation-report) .inventory-evidence-grid',
  '{grid-template-columns:repeat(3,minmax(0,1fr))!important;}',
  'article.report:not(.quick-safety-orientation-report) figure{min-width:0!important;}',
  'article.report:not(.quick-safety-orientation-report) figcaption',
  '{overflow-wrap:anywhere!important;white-space:normal!important;}'
 ].join('');
 container.appendChild(style);
 return true;
}

export async function renderPaginatedPdf(container,pageSize,options,render=html2canvas,Pdf=jsPDF){
  const width=pageSize.inner.width*96;
  const pageHeight=pageSize.inner.px.height;
  // Export only: freeze the original Letter layout regardless of iPad/phone
  // CSS breakpoints, then position full photo sheets and signatures.
  applyAdaptiveReportPdfLayout(container,pageSize,{
    sourceDevice:typeof window==='undefined'?'desktop':deviceKindFromWindow(window)
  });
  stabilizeNonQuickPdfColumns(container);
  // html2canvas slices fixed-height images; ordinary CSS page-break rules do
  // not stop a signature or corrective-action panel from being sliced.
  // Align intact blocks in the temporary PDF clone before measuring its height.
  alignCriticalReportPdfBlocks(container,pageHeight);
  alignGeneralReportPdfEvidence(container,pageHeight);
  const totalHeight=Math.max(1,container.scrollHeight);
  // Preserve exactly the same lossless-text / high-quality-photo page choice
  // while avoiding O(pages * photos) repeated DOM layout measurements.
  const evidencePositions=indexPdfEvidencePositions(container);
  const pdf=new Pdf({...options.jsPDF,compress:true});
  let pagesAdded=0;
  for(let top=0,index=0;top<totalHeight;top+=pageHeight,index++){
    const height=Math.min(pageHeight,totalHeight-top);
    let canvas;
    try{
      canvas=await render(container,{...options.html2canvas,scale:pdfRenderScale,
        x:0,y:top,width,height,scrollX:0,scrollY:0});
      if(!canvas.width||!canvas.height)throw new Error('Unable to render PDF page '+(index+1));
      // Only JHA opts into removing an empty FIRST slice; all other
      // documents keep their approved pagination byte-for-byte.
      // A genuinely empty raster is never appended to a final report.
      // Do not remove faint content: the strict scan retains any detectable
      // logo, text, border, evidence, or signature.
      const strictlyEmpty=pdfCanvasPageIsTrulyEmpty(canvas);
      if(!(strictlyEmpty||(options.skipBlankLeadingPage&&pagesAdded===0&&
          pdfCanvasPageIsBlank(canvas)))){
        if(pagesAdded)pdf.addPage();
        const raster=pdfPageRasterChoice(container,top,height,evidencePositions);
        const encoded=raster.format==='PNG'
          ?canvas.toDataURL(raster.mime)
          :canvas.toDataURL(raster.mime,raster.quality);
        pdf.addImage(encoded,raster.format,options.margin[1],options.margin[0],
          pageSize.inner.width,height/96,undefined,'FAST');
        pagesAdded++;
      }
    }finally{
      if(canvas){canvas.width=0;canvas.height=0}
    }
    // Release each page canvas before rendering the next. For automatic iPad
    // archives (no progress callback), yield the visible UI between pages so
    // touching a control or scrolling is not frozen by a long report export.
    if(options.onPageRendered)await options.onPageRendered(index+1,Math.ceil(totalHeight/pageHeight));
    else if(top+pageHeight<totalHeight&&typeof document!=='undefined'&&document.visibilityState==='visible')
      await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(!pagesAdded)throw new Error('JHA PDF has no visible page content');
  return pdf.output('blob');
}

// This independent report always exports one landscape letter sheet. Fit uniformly,
// rather than slicing or stretching the document; other report exporters stay unchanged.
export async function renderQuickOrientationPdf(container,pageSize,options,render=html2canvas,Pdf=jsPDF){
  const report=container.querySelector('.quick-safety-orientation-report');
  if(!report)throw new Error('Quick orientation report not found');
  const style=container.ownerDocument.createElement('style');
  style.textContent=`
    .quick-safety-orientation-report{box-sizing:border-box!important;width:1008px!important;max-width:none!important;margin:0!important;padding:10px!important;border:0!important;box-shadow:none!important}
    .quick-safety-orientation-report .no-print{display:none!important}
    .quick-report-header{grid-template-columns:130px 1fr auto!important;gap:12px!important;padding-bottom:8px!important}
    .quick-report-header>img{width:120px!important;max-height:60px!important}
    .quick-report-complete{grid-column:auto!important}
    .quick-report-employee{grid-template-columns:1.05fr .8fr 1fr 1.3fr 1.2fr .95fr!important;margin-top:8px!important}
    .quick-report-employee.has-face-photo{grid-template-columns:minmax(0,1.05fr) minmax(0,.8fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.2fr) minmax(0,.95fr) 88px!important}
    .quick-report-employee>.quick-report-employee-photo{padding:5px!important;min-height:94px!important}
    .quick-report-employee-photo img{width:74px!important;height:76px!important;object-fit:contain!important;object-position:center!important}
    .quick-report-employee>div{padding:7px!important;border-top:0!important}
    .quick-report-hazards{margin-top:8px!important}
    .quick-report-hazards>header{padding:7px 9px!important}
    .quick-report-hazard-columns{grid-template-columns:1fr 1fr!important}
    .quick-report-hazard{padding:5px 8px!important}
    .quick-report-photos{grid-template-columns:repeat(4,minmax(0,1fr))!important}
    .quick-report-photos img{height:115px!important;object-fit:contain!important}
    .quick-report-photo-section,.quick-report-acknowledgment,.quick-report-signatures{margin-top:8px!important}
    .quick-report-acknowledgment,.quick-report-signatures{padding:7px 9px!important}
    .quick-report-signatures .report-signatures{grid-template-columns:1fr 1fr!important}
    .quick-report-signatures .report-signatures>div{min-height:48px!important}
    .quick-report-footer{margin-top:8px!important;flex-wrap:nowrap!important}
  `;
  container.append(style);
  container.style.width='1008px';
  // Explicit intrinsic dimensions also preserve aspect ratio in canvas renderers
  // whose support for object-fit differs from the browser's image rendering.
  const reportImages=[...report.querySelectorAll('.quick-report-photos img,.quick-report-header>img,.quick-report-employee-photo img')];
  // Image decodes are independent. Run them together instead of forcing one
  // high-resolution employee/photo thumbnail to hold up every following image.
  // Geometry and original PNG export stay unchanged after all decodes complete.
  await Promise.all(reportImages.map(async img=>{
    if(img.decode)await img.decode();
    if(!img.naturalWidth||!img.naturalHeight)throw new Error('Report image could not be loaded');
  }));
  for(const img of reportImages){
    const box=img.getBoundingClientRect(),ratio=Math.min(box.width/img.naturalWidth,box.height/img.naturalHeight);
    img.style.setProperty('width',img.naturalWidth*ratio+'px','important');
    img.style.setProperty('height',img.naturalHeight*ratio+'px','important');
    img.style.margin='auto';
    if(img.closest('figure')){const figure=img.closest('figure');figure.style.minHeight='135px';}
  }
  const width=1008,height=Math.ceil(report.getBoundingClientRect().height);
  const pdf=new Pdf({...options.jsPDF,compress:true});let canvas;
  try{
    canvas=await render(report,{...options.html2canvas,scale:2,width,height,windowWidth:1200,scrollX:0,scrollY:0});
    if(!canvas.width||!canvas.height)throw new Error('Unable to render orientation PDF');
    const fit=Math.min(pageSize.inner.width/width,pageSize.inner.height/height);
    const outputWidth=width*fit,outputHeight=height*fit;
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',options.margin[1]+(pageSize.inner.width-outputWidth)/2,options.margin[0],outputWidth,outputHeight,undefined,'FAST');
    return pdf.output('blob');
  }finally{if(canvas){canvas.width=0;canvas.height=0}}
}
