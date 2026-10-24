// Device recognition changes only responsive presentation. Final PDF pages remain
// Letter-sized regardless of the originating iPad or phone.
export function reportDeviceKind({userAgent='',platform='',maxTouchPoints=0,mobileHint=false,screenWidth=0,screenHeight=0,coarse=false}={}){
 const ua=String(userAgent).toLowerCase(),system=String(platform).toLowerCase();
 if(/ipad/.test(ua)||((/macintosh/.test(ua)||system==='macintel')&&Number(maxTouchPoints)>1))return 'ipad';
 if(mobileHint||/iphone|ipod|android.*mobile|windows phone/.test(ua))return 'mobile';
 if(/android|tablet/.test(ua))return 'tablet';
 const shortest=Math.min(Number(screenWidth)||9999,Number(screenHeight)||9999);
 return coarse&&shortest<600?'mobile':'desktop';
}
export function deviceKindFromWindow(win){
 const nav=win?.navigator||{},screen=win?.screen||{};
 return reportDeviceKind({
  userAgent:nav.userAgent,platform:nav.platform,maxTouchPoints:nav.maxTouchPoints,
  mobileHint:nav.userAgentData?.mobile===true,
  screenWidth:screen.width,screenHeight:screen.height,
  coarse:Boolean(win?.matchMedia?.('(any-pointer: coarse)').matches)
 });
}
const pdfRules=[
 'article.report.ge-reference-jha,article.report.equipment-pdf{width:var(--ge-pdf-width)!important;max-width:var(--ge-pdf-width)!important;min-width:var(--ge-pdf-width)!important;box-sizing:border-box!important;margin:0!important;overflow:visible!important}',
 'article.report.ge-reference-jha{padding:0!important}',
 'article.report.equipment-pdf{padding:22px!important}',
 'article.report.ge-reference-jha .ewr-header{grid-template-columns:210px minmax(0,1fr) 135px!important;gap:12px!important;text-align:left!important}',
 'article.report.ge-reference-jha .ewr-project{grid-template-columns:1.5fr 1fr 1fr!important}',
 'article.report.ge-reference-jha .ewr-tr{grid-template-columns:30px minmax(0,2fr) 88px minmax(0,2fr)!important}',
 'article.report.ge-reference-jha .ewr-tr>span:last-child{grid-column:auto!important}',
 'article.report.ge-reference-jha .ewr-hazard-grid,article.report.ge-reference-jha .ewr-signatures{grid-template-columns:repeat(2,minmax(0,1fr))!important}',
 'article.report.ge-reference-jha .ewr-closeout{grid-template-columns:2fr 1fr 1.5fr!important}',
 'article.report.equipment-pdf .eq-pdf-head{grid-template-columns:68px minmax(0,1fr) auto!important}',
 'article.report.equipment-pdf .eq-doc{grid-column:auto!important;text-align:right!important}',
 'article.report.equipment-pdf .eq-pdf-meta{grid-template-columns:repeat(4,minmax(0,1fr))!important}',
 'article.report.equipment-pdf .eq-info{grid-template-columns:repeat(3,minmax(0,1fr))!important}',
 'article.report.equipment-pdf .eq-corrective,article.report.equipment-pdf .eq-signatures{grid-template-columns:repeat(2,minmax(0,1fr))!important}',
 'article.report.ge-reference-jha .ewr-photo-page,article.report.equipment-pdf .eq-photo-page{break-before:auto!important;page-break-before:auto!important;overflow:visible!important}',
 'article.report.ge-reference-jha .ewr-photo-page .ewr-photo-register-grid,article.report.equipment-pdf .eq-photo-page .eq-photos{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;min-width:0!important;overflow:visible!important}',
 'article.report.ge-reference-jha .ewr-photo-page .ewr-photo-card{display:flex!important;flex-direction:column!important;min-width:0!important;height:auto!important;overflow:visible!important;box-sizing:border-box!important}',
 'article.report.ge-reference-jha .ewr-photo-page .ewr-photo-card>img{display:block!important;width:100%!important;height:var(--ge-pdf-photo-height,150px)!important;max-height:var(--ge-pdf-photo-height,150px)!important;min-height:0!important;object-fit:contain!important;object-position:center!important}',
 'article.report.equipment-pdf .eq-photo-page .eq-photos{grid-template-rows:none!important;padding:7px!important}',
 'article.report.equipment-pdf .eq-photo-page figure{height:auto!important;min-height:0!important;overflow:visible!important}',
 'article.report.equipment-pdf .eq-photo-page .eq-photo-frame{height:var(--ge-pdf-photo-height,165px)!important;min-height:var(--ge-pdf-photo-height,165px)!important}',
 'article.report.equipment-pdf .eq-photo-page figure img{height:auto!important;width:auto!important;max-height:var(--ge-pdf-photo-height,165px)!important;max-width:100%!important;object-fit:contain!important;object-position:center!important}',
 'article.report.ge-reference-jha .ewr-photo-page figcaption,article.report.equipment-pdf .eq-photo-page figcaption{height:auto!important;min-height:0!important;white-space:normal!important;overflow:visible!important;overflow-wrap:anywhere!important}',
 'article.report.ge-reference-jha .ewr-photo-page .ewr-photo-card p,article.report.ge-reference-jha .ewr-photo-page .ewr-photo-card figcaption,article.report.equipment-pdf .eq-photo-page figcaption{font-size:8px!important;line-height:1.3!important}',
 'article.report.ge-reference-jha .ewr-photo-page .ewr-photo-card p{overflow-wrap:anywhere!important;white-space:pre-wrap!important}',
 'article.report.ge-reference-jha .ewr-photo-page .ewr-section-title{margin:0 0 8px!important;padding:5px 8px!important}'
].join('\n');
export function applyAdaptiveReportPdfLayout(container,pageSize,{sourceDevice='desktop'}={}){
 const report=container?.querySelector?.('article.report.ge-reference-jha,article.report.equipment-pdf');
 if(!report)return {applied:false,photoPages:0};
 const width=Math.round((pageSize?.inner?.width||8)*96);
 if(!Number.isFinite(width)||width<360)return {applied:false,photoPages:0};
 const doc=container.ownerDocument||report.ownerDocument;
 if(!doc?.createElement)return {applied:false,photoPages:0};
 const style=doc.createElement('style');
 style.setAttribute('data-ge-pdf-device-layout','');
 style.textContent=pdfRules;
 container.appendChild(style);
 report.style.setProperty('--ge-pdf-width',width+'px');
 report.dataset.geSourceDevice=sourceDevice; // Temporary clone, not a database field.
 const pages=[...report.querySelectorAll('.ewr-photo-page[data-jha-pdf-page],.eq-photo-page[data-equipment-pdf-page]')];
 const pageHeight=Number(pageSize?.inner?.px?.height)||1003;
 for(const page of pages){
  const figures=[...page.querySelectorAll('figure')];
  if(figures.length>6)throw Error('Photo page exceeds six photos');
  const isEquipment=report.classList.contains('equipment-pdf');
  let current=figures.length>4?(isEquipment?165:150):figures.length>2?200:255;
  page.style.setProperty('--ge-pdf-photo-height',current+'px');
  // Shrink only the displayed image box, preserving all text and image pixels.
  if(typeof page.getBoundingClientRect==='function'){
   for(;current>88;current-=12){
    const height=page.getBoundingClientRect().height;
    if(!height||height<=pageHeight-20)break;
    page.style.setProperty('--ge-pdf-photo-height',Math.max(88,current-12)+'px');
   }
  }
 }
 return {applied:true,photoPages:pages.length,sourceDevice};
}
