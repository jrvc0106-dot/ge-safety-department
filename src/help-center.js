import './help-center.css';
const topics=[
 ['jha','Daily Report JHA','Reporte JHA','file-text'],
 ['pdf','PDF / Download','PDF / Descargas','file-down'],
 ['photos','Camera / Photos','Cámara / Fotos','camera'],
 ['sign','Digital Signatures','Firmas digitales','pen-tool'],
 ['inventory','Inventory','Inventario','package'],
 ['access','Access / Login','Acceso / Inicio de sesión','lock'],
 ['external','Vercel / Supabase','Vercel / Supabase','settings']
];
const sample={
 jha:['How do I save a JHA draft and download the final PDF?','¿Cómo guardo un borrador JHA y descargo el PDF final?'],
 pdf:['The PDF shows Load Failed. What should I check?','El PDF muestra Load Failed. ¿Qué debo revisar?'],
 photos:['My iPad camera or photo gallery is not opening.','La cámara o galería de mi iPad no abre.'],
 sign:['My digital signature does not appear in the PDF.','Mi firma digital no aparece en el PDF.'],
 inventory:['How do I quickly add multiple inventory items?','¿Cómo agrego varios artículos al inventario rápidamente?'],
 access:['I cannot sign in or my account has no access.','No puedo iniciar sesión o mi cuenta no tiene acceso.'],
 external:['What problems require an administrator to use Vercel or Supabase?','¿Qué problemas requieren que un administrador use Vercel o Supabase?']
};
const offline={
 es:'Revisa tu conexión, vuelve a iniciar sesión si expiró y prueba de nuevo. Para problemas de PDF, confirma que el reporte esté guardado y abre Reports. Para cámara en iPad, revisa los permisos del navegador. Si continúa, anota el mensaje exacto y avisa al administrador.',
 en:'Check your connection, sign in again if your session expired and retry. For PDFs, confirm the report was saved and open Reports. For iPad camera issues, check browser permissions. If the issue persists, record the exact error and contact your administrator.'
};
export function helpCenterPage({frame,tr,esc,session,lang}){
 frame('<section class="ge-help"><div class="ge-help-header"><div class="ge-help-icon">?</div><div><small>G&E ONE</small><h1>'+tr('Help Center · AI Support','Centro de ayuda · Soporte IA')+'</h1><p>'+tr('App support, troubleshooting and guided steps.','Ayuda con la aplicación, errores y orientación paso a paso.')+'</p></div></div><div class="ge-help-privacy" role="note">'+tr('Do not send medical records, employee personal information, passwords, API keys or confidential screenshots. Screenshots are sent to Google Gemini only when you submit them. AI answers may be inaccurate.','No envíes documentos médicos, datos personales de empleados, contraseñas, claves API ni capturas confidenciales. Las capturas se envían a Google Gemini únicamente cuando las envías. La IA puede equivocarse.')+'</div><h2>'+tr('What do you need help with?','¿En qué necesitas ayuda?')+'</h2><div class="ge-help-topics">'+topics.map(([id,en,es])=>'<button type="button" data-help-topic="'+id+'">'+esc(tr(en,es))+'</button>').join('')+'</div><div id="ge-help-chat" class="ge-help-chat" role="log" aria-live="polite"><p class="ge-help-intro">'+tr('Describe your problem. I can guide you, but cannot change the app or access live logs.','Describe tu problema. Puedo orientarte, pero no puedo modificar la app ni acceder a registros en vivo.')+'</p></div><form id="ge-help-form" class="ge-help-form"><label for="ge-help-question">'+tr('Your question','Tu pregunta')+'</label><textarea id="ge-help-question" maxlength="2500" rows="3" required placeholder="'+tr('Example: I cannot download my JHA report…','Ejemplo: No puedo descargar mi reporte JHA…')+'"></textarea><label class="ge-help-attachment">'+tr('Optional screenshot (JPG, PNG, WebP, max 2 MB)','Captura opcional (JPG, PNG, WebP, máximo 2 MB)')+'<input type="file" id="ge-help-image" accept="image/jpeg,image/png,image/webp"></label><div id="ge-help-file" class="ge-help-file"></div><div class="ge-help-actions"><button type="submit" id="ge-help-send">'+tr('Ask AI Support','Consultar soporte IA')+'</button><button type="button" class="secondary" id="ge-help-clear">'+tr('Clear conversation','Limpiar conversación')+'</button></div><p id="ge-help-status" role="status"></p></form><p class="ge-help-footnote">'+tr('Free-tier Gemini 2.5 Flash-Lite is subject to Google availability and quotas. No automatic paid upgrade.','Gemini 2.5 Flash-Lite gratuito depende de la disponibilidad y las cuotas de Google. Sin activación automática de pagos.')+'</p></section>');
 const form=document.querySelector('#ge-help-form'),question=document.querySelector('#ge-help-question'),chat=document.querySelector('#ge-help-chat'),status=document.querySelector('#ge-help-status'),file=document.querySelector('#ge-help-image'),fileLabel=document.querySelector('#ge-help-file'),send=document.querySelector('#ge-help-send');
 document.querySelectorAll('[data-help-topic]').forEach(btn=>btn.onclick=()=>{question.value=sample[btn.dataset.helpTopic][lang==='es'?1:0];question.focus()});
 file.onchange=()=>{const selected=file.files?.[0];fileLabel.textContent=selected?selected.name+' ('+Math.ceil(selected.size/1024)+' KB)':''};
 document.querySelector('#ge-help-clear').onclick=()=>{chat.replaceChildren();question.value='';file.value='';fileLabel.textContent='';status.textContent=''};
 const add=(who,text)=>{const node=document.createElement('div');node.className='ge-help-message '+who;const title=document.createElement('strong');title.textContent=who==='user'?tr('You','Tú'):'G&E ONE AI Support';const body=document.createElement('p');body.textContent=text;node.append(title,body);chat.append(node);node.scrollIntoView({block:'nearest'})};
 form.onsubmit=async e=>{
  e.preventDefault();const message=question.value.trim();if(!message)return;
  const selected=file.files?.[0];if(selected&&(selected.size>2000000||!['image/jpeg','image/png','image/webp'].includes(selected.type))){status.textContent=tr('Select a JPG, PNG or WebP screenshot under 2 MB.','Selecciona una captura JPG, PNG o WebP menor de 2 MB.');return}
  send.disabled=true;status.textContent=tr('Checking…','Consultando…');
  try{
   let image;
   if(selected){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(selected)});image={mimeType:selected.type,data}}
   const response=await fetch('/api/help',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({message,lang,image})});
   const result=await response.json();add('user',message+(selected?tr(' (screenshot attached)',' (captura adjunta)'):''));
   if(!response.ok){add('assistant',result.error||tr('Help is temporarily unavailable.','La ayuda no está disponible temporalmente.')+(result.guide?' '+result.guide:''));if(result.guide)add('assistant',result.guide)}
   else add('assistant',result.answer);
   question.value='';file.value='';fileLabel.textContent='';status.textContent='';
  }catch{add('user',message);add('assistant',offline[lang==='es'?'es':'en']);status.textContent=tr('AI is offline. Basic troubleshooting is available.','La IA está desconectada. Se muestra ayuda básica.')}
  finally{send.disabled=false}
 };
}
