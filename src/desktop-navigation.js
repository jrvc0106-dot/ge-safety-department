// Desktop navigation only. No business logic, PDF or tablet/mobile modifications.
const links=[
 ['home','⌂','Home','Inicio'],
 ['safetyWalk','▤','Daily Reports (JHA)','Reportes diarios (JHA)'],
 ['observations','◎','Observations','Observaciones'],
 ['incident','△','Incidents','Incidentes'],
 ['equipmentInspection','☑','Inspections','Inspecciones'],
 ['toolboxTalk','☷','Toolbox Talks','Charlas de seguridad'],
 ['team','♙','Team Field / Orientation','Orientación / Equipo'],
 ['discipline','⚑','Disciplinary','Disciplina'],
 ['inventory','▣','Inventory','Inventario'],
 ['reportCenter','▤','Report Center','Centro de reportes'],
 ['cloudBackup','☁','Cloud Backup','Respaldo en la nube'],
 ['setPassword','⚙','Settings','Configuración']
];
export function mountDesktopNavigation({doc=document,authenticated=false,page='home',lang='en',go,role=''}) {
 doc.querySelector('#ge-desktop-sidebar')?.remove();
 if (!authenticated || !doc.querySelector('#app > main')) return;
 const aside=doc.createElement('aside');
 aside.id='ge-desktop-sidebar';
 aside.setAttribute('aria-label',lang==='es'?'Navegación de escritorio':'Desktop navigation');
 const logo=doc.createElement('div');logo.className='ge-desktop-logo';
 logo.innerHTML='<img src="/ge-logo.png" alt="G&E Florida Contractors"><strong>GE ONE</strong>';
 aside.appendChild(logo);
 const list=doc.createElement('nav');
 for(const [target,icon,en,es] of links){
  if(target==='cloudBackup' && role!=='admin') continue;
  if(target==='discipline' && !['admin','safety_director','safety'].includes(role)) continue;
  const btn=doc.createElement('button');btn.type='button';btn.className='ge-desktop-link';
  if(page===target)btn.classList.add('is-active');
  btn.innerHTML='<span class="ge-desktop-icon" aria-hidden="true">'+icon+'</span><span>'+ (lang==='es'?es:en)+'</span>';
  btn.addEventListener('click',()=>go(target));list.appendChild(btn);
 }
 aside.appendChild(list);doc.querySelector('#app > header')?.after(aside);
}
