import html2canvas from 'html2canvas';
import {jsPDF} from 'jspdf';

// 200 DPI keeps text, signatures and photos clear while holding each letter page
// below the app's 4 MP canvas budget on iPads. JPEG avoids huge lossless PDFs.
const pdfRenderScale=200/96;
export async function renderPaginatedPdf(container,pageSize,options,render=html2canvas,Pdf=jsPDF){
  const width=pageSize.inner.width*96;
  const pageHeight=pageSize.inner.px.height;
  const totalHeight=Math.max(1,container.scrollHeight);
  const pdf=new Pdf({...options.jsPDF,compress:true});
  for(let top=0,index=0;top<totalHeight;top+=pageHeight,index++){
    const height=Math.min(pageHeight,totalHeight-top);
    let canvas;
    try{
      canvas=await render(container,{...options.html2canvas,scale:pdfRenderScale,
        x:0,y:top,width,height,scrollX:0,scrollY:0});
      if(!canvas.width||!canvas.height)throw new Error('Unable to render PDF page '+(index+1));
      if(index)pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg',0.92),'JPEG',options.margin[1],options.margin[0],
        pageSize.inner.width,height/96,undefined,'FAST');
    }finally{
      if(canvas){canvas.width=0;canvas.height=0}
    }
    // Release each page canvas before rendering the next, keeping tablet controls responsive.
    if(options.onPageRendered)await options.onPageRendered(index+1,Math.ceil(totalHeight/pageHeight));
  }
  return pdf.output('blob');
}
