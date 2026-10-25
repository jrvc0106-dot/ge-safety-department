// Avoid splitting complete report sections across the fixed-height raster slices
// used for high-resolution PDF exports. Only the JHA and Equipment templates opt in.
export function alignCriticalReportPdfBlocks(container,pageHeight){
 if(!container?.querySelector||!(pageHeight>0))return 0;
 const report=container.querySelector('article.ge-reference-jha,article.equipment-pdf');
 if(!report)return 0;
 const isJha=report.classList.contains('ge-reference-jha');
 const selectors=isJha
  ?'.ewr-section, .ewr-section-title, .ewr-tr, .ewr-signatures, .ge-pdf-photo-note, .ewr-footer, [data-jha-pdf-page]'
  :'section, .eq-table tr, .eq-corrective, .eq-signatures, footer, [data-equipment-pdf-page]';
 const nodes=[...report.querySelectorAll(selectors)];
 const doc=container.ownerDocument||report.ownerDocument;
 if(!doc?.createElement||!container.getBoundingClientRect)return 0;
 let added=0;
 for(const node of nodes){
  const parent=node.parentNode;
  if(!parent||!node.getBoundingClientRect)continue;
  const rect=node.getBoundingClientRect();
  const top=rect.top-container.getBoundingClientRect().top+(container.scrollTop||0);
  const height=rect.height||rect.bottom-rect.top;
  if(!Number.isFinite(top)||!Number.isFinite(height)||top<0||height<=0)continue;
  const remainder=((top%pageHeight)+pageHeight)%pageHeight;
  const photoPage=node.hasAttribute('data-jha-pdf-page')||node.hasAttribute('data-equipment-pdf-page');
  // An oversized section must not be pushed indefinitely; only protect blocks
  // that fit on one sheet. Photo sheets retain their established start alignment.
  if(remainder<2||(!photoPage&&height>pageHeight-12))continue;
  if(!photoPage&&remainder+height<=pageHeight-8)continue;
  const gap=pageHeight-remainder;
  // A spacer DIV is invalid inside <tbody>/<thead> and can be hoisted out
  // of the table by a browser, making the PDF page split unpredictable.
  // Keep equipment checklist spacers as legitimate, non-printing table rows.
  const isTableRow=node.tagName?.toUpperCase()==='TR';
  const spacer=doc.createElement(isTableRow?'tr':'div');
  spacer.className='ge-pdf-page-alignment-spacer';
  spacer.setAttribute('aria-hidden','true');
  if(isTableRow){
   spacer.style.cssText='height:'+gap+'px;border:0;background:transparent;';
   const cell=doc.createElement('td');
   cell.colSpan=4;
   cell.style.cssText='height:'+gap+'px;padding:0;border:0;line-height:0;font-size:0;';
   spacer.appendChild(cell);
  }else{
   spacer.style.cssText='display:block;box-sizing:border-box;margin:0;padding:0;border:0;width:100%;height:'+gap+'px;';
  }
  parent.insertBefore(spacer,node);
  added++;
 }
 return added;
}


// Keep whole evidence photos (including their captions), signature panels and
// report footers on a single sheet in OTHER high-quality report types.
// JHA/Equipment use their existing, more specialized six-photo pagination.
// Work only on the temporary html2pdf clone; saved report HTML is untouched.
export function alignGeneralReportPdfEvidence(container,pageHeight){
 if(!container?.querySelector||!(pageHeight>0))return 0;
 const report=container.querySelector('article.report:not(.ge-reference-jha):not(.equipment-pdf):not(.quick-safety-orientation-report)');
 if(!report?.querySelectorAll||!container.getBoundingClientRect)return 0;
 const doc=container.ownerDocument||report.ownerDocument;
 if(!doc?.createElement)return 0;
 const selector=[
  '.report-photos figure','.ir-photos figure','.inventory-evidence figure',
  '.report-photo-grid figure','.registered-orientation-evidence',
  '.report-signatures','.dr-signatures','.ir-signatures',
  '.registered-orientation-signatures','.report-footer',
  '.registered-orientation-footer'
 ].join(',');
 const blocks=[...report.querySelectorAll(selector)];
 let moved=0;
 for(const node of blocks){
  if(!node.parentNode||!node.getBoundingClientRect)continue;
  const rect=node.getBoundingClientRect();
  const start=rect.top-container.getBoundingClientRect().top+(container.scrollTop||0);
  const height=rect.height||rect.bottom-rect.top;
  // A block taller than one printable sheet cannot be saved by padding.
  // Such reports need their own content-aware continuation pages instead.
  if(!Number.isFinite(start)||!Number.isFinite(height)||start<0||
     height<=0||height>=pageHeight-24)continue;
  const position=((start%pageHeight)+pageHeight)%pageHeight;
  if(position<2||position+height<=pageHeight-8)continue;
  const gap=pageHeight-position;
  const spacer=doc.createElement('div');
  spacer.className='ge-pdf-evidence-alignment-spacer';
  spacer.setAttribute('aria-hidden','true');
  spacer.style.cssText='display:block;box-sizing:border-box;margin:0;padding:0;border:0;width:100%;height:'+gap+'px;';
  node.parentNode.insertBefore(spacer,node);
  moved++;
 }
 return moved;
}
