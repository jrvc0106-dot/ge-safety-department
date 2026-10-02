const roles=['safety','superintendent'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function signatureStrokes(value){
 try{const strokes=typeof value==='string'?JSON.parse(value||'[]'):value;
  if(!Array.isArray(strokes)||strokes.length>500)return [];
  let count=0;
  if(!strokes.every(s=>Array.isArray(s)&&s.length&&s.every(p=>++count<=20000&&Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1))))return [];
  return strokes;
 }catch{return []}
}
export function jhaSignatureFields(tr){
 return '<div class="jha-approval-fields">'+roles.map(role=>{
  const label=role==='safety'?tr('Assigned Safety','Safety asignado'):tr('Jobsite Superintendent','Superintendente del jobsite');
  return `<section class="jha-approval"><label>${label}<input name="jha_${role}_name" maxlength="160" autocomplete="off" placeholder="${tr('Full name','Nombre completo')}"></label><label>${tr('Digital signature','Firma digital')}<input type="hidden" name="jha_${role}_signature" value="[]"><canvas width="900" height="300" data-jha-signature="${role}" aria-label="${label}: ${tr('sign with your finger, stylus or mouse','firme con el dedo, lápiz o mouse')}"></canvas></label><small>${tr('Sign with your finger, stylus or mouse.','Firme con el dedo, lápiz o mouse.')}</small><button type="button" class="secondary" data-jha-clear="${role}">${tr('Clear signature','Borrar firma')}</button></section>`;
 }).join('')+'</div>';
}
export function attachJhaSignatures(form){
 for(const role of roles){
  const canvas=form.querySelector(`[data-jha-signature="${role}"]`),input=form.elements.namedItem(`jha_${role}_signature`);
  if(!canvas||!input)continue;
  const ctx=canvas.getContext('2d');if(!ctx)continue;
  let strokes=signatureStrokes(input.value),pointer=null,stroke=null,saveTimer=null;
  let pointCount=strokes.reduce((n,s)=>n+s.length,0);
  const draw=()=>{
   ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#202830';ctx.fillStyle='#202830';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';
   for(const s of strokes){ctx.beginPath();ctx.moveTo(s[0][0]*canvas.width,s[0][1]*canvas.height);for(const p of s.slice(1))ctx.lineTo(p[0]*canvas.width,p[1]*canvas.height);if(s.length===1){ctx.arc(s[0][0]*canvas.width,s[0][1]*canvas.height,1.5,0,Math.PI*2);ctx.fill()}else ctx.stroke()}
  };
  const notify=()=>{clearTimeout(saveTimer);saveTimer=null;input.dispatchEvent(new Event('input',{bubbles:true}))};
  const save=(immediate=true)=>{
   // Keep current strokes available to submit and visibility-triggered draft saves.
   input.value=JSON.stringify(strokes);
   if(immediate)notify();else if(saveTimer===null)saveTimer=setTimeout(()=>{saveTimer=null;if(input.isConnected)notify()},180);
  };
  const point=e=>{const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))].map(n=>Math.round(n*10000)/10000)};
  input.addEventListener('change',()=>{clearTimeout(saveTimer);saveTimer=null;strokes=signatureStrokes(input.value);pointCount=strokes.reduce((n,s)=>n+s.length,0);pointer=null;stroke=null;draw()});
  canvas.addEventListener('pointerdown',e=>{
   if(pointer!==null||(e.pointerType==='mouse'&&e.button!==0)||strokes.length>=500||pointCount>=20000)return;
   e.preventDefault();pointer=e.pointerId;stroke=[point(e)];strokes.push(stroke);pointCount++;canvas.setPointerCapture?.(pointer);draw();save();
  });
  canvas.addEventListener('pointermove',e=>{
   if(e.pointerId!==pointer||!stroke)return;e.preventDefault();
   if(pointCount>=20000)return;
   const previous=stroke[stroke.length-1],next=point(e);
   if(previous[0]===next[0]&&previous[1]===next[1])return;
   stroke.push(next);pointCount++;
   ctx.beginPath();ctx.moveTo(previous[0]*canvas.width,previous[1]*canvas.height);ctx.lineTo(next[0]*canvas.width,next[1]*canvas.height);ctx.stroke();save(false);
  });
  const finish=e=>{if(e.pointerId!==pointer)return;pointer=null;stroke=null;save()};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,finish);
  form.querySelector(`[data-jha-clear="${role}"]`).onclick=()=>{strokes=[];pointCount=0;pointer=null;stroke=null;draw();save()};
  draw();
 }
}
export function jhaApprovals(data){
 return Object.fromEntries(roles.map(role=>[role,{name:String(data.get(`jha_${role}_name`)||'').slice(0,160),strokes:signatureStrokes(data.get(`jha_${role}_signature`))}]));
}
export function jhaSignaturesReport(approvals,tr){
 return '<div class="ewr-signatures jha-signed-approvals">'+roles.map(role=>{
  const record=approvals?.[role]||{},strokes=signatureStrokes(record.strokes),label=role==='safety'?tr('Assigned Safety','Safety asignado'):tr('Jobsite Superintendent','Superintendente del jobsite');
  const paths=strokes.map(s=>s.length===1?`<circle cx="${s[0][0]*900}" cy="${s[0][1]*300}" r="1.5" fill="#202830"/>`:`<path d="M${s.map(p=>`${p[0]*900},${p[1]*300}`).join(' L')}"/>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300" viewBox="0 0 900 300"><g fill="none" stroke="#202830" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
  return `<div>${strokes.length?`<img class="jha-report-signature" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" alt="${label}: ${tr('Digital signature','Firma digital')}">`:'<span class="jha-signature-space"></span>'}<strong>${esc(record.name||'—')}</strong><small>${label}</small></div>`;
 }).join('')+'</div>';
}
