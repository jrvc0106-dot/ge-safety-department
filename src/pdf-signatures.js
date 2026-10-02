import {signatureStrokes} from './jha-signatures.js';

// html2canvas can reject SVG images when its SVG capability probe fails on
// Safari. Draw the stored strokes directly so export never depends on SVG.
export async function rasterizePdfSignatures(container){
 const images=container.querySelectorAll('img.jha-report-signature[data-signature-strokes]');
 for(const image of images){
  const strokes=signatureStrokes(image.dataset.signatureStrokes);
  if(!strokes.length)throw Error('Unable to render the saved digital signature.');
  const canvas=container.ownerDocument.createElement('canvas');canvas.width=900;canvas.height=300;
  try{
   const context=canvas.getContext('2d');if(!context)throw Error('Unable to render the saved digital signature.');
   context.strokeStyle='#202830';context.fillStyle='#202830';context.lineWidth=3;context.lineCap='round';context.lineJoin='round';
   for(const stroke of strokes){
    context.beginPath();context.moveTo(stroke[0][0]*900,stroke[0][1]*300);
    if(stroke.length===1){context.arc(stroke[0][0]*900,stroke[0][1]*300,1.5,0,Math.PI*2);context.fill()}
    else{for(const point of stroke.slice(1))context.lineTo(point[0]*900,point[1]*300);context.stroke()}
   }
   const png=canvas.toDataURL('image/png');
   if(!png.startsWith('data:image/png;base64,'))throw Error('Unable to render the saved digital signature.');
   image.src=png;
   if(typeof image.decode==='function')await image.decode();
  }finally{canvas.width=0;canvas.height=0}
 }
 return images.length;
}
