// Keep the fixed navigation out of the on-screen keyboard's editing area.
export function installTabletViewport(win=window,doc=document){
 const viewport=win.visualViewport;
 if(!viewport||!win.matchMedia('(any-pointer: coarse)').matches)return ()=>{};
 let frame=null;
 const update=()=>{
  frame=null;
  const field=doc.activeElement;
  const editing=field?.matches('textarea,input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]),[contenteditable="true"]');
  const keyboard=editing&&viewport.scale===1&&win.innerHeight-viewport.height>150;
  doc.documentElement.toggleAttribute('data-ge-keyboard',Boolean(keyboard));
 };
 const schedule=()=>{if(frame===null)frame=win.requestAnimationFrame(update)};
 viewport.addEventListener('resize',schedule);
 doc.addEventListener('focusin',schedule);
 doc.addEventListener('focusout',schedule);
 update();
 return ()=>{
  if(frame!==null)win.cancelAnimationFrame(frame);
  viewport.removeEventListener('resize',schedule);
  doc.removeEventListener('focusin',schedule);
  doc.removeEventListener('focusout',schedule);
  doc.documentElement.removeAttribute('data-ge-keyboard');
 };
}
