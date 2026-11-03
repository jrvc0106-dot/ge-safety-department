// Desktop-only read-only command panel. Uses existing in-memory project observations.
export function mountDesktopCommand({doc=document,authenticated=false,lang='en',projectId=null,projects=[],observations=[],go=()=>{}}={}) {
 doc.querySelector('#ge-desktop-command')?.remove();
 if(!authenticated || !doc.querySelector('#app > main'))return;
 const es=lang==='es', tr=(a,b)=>es?b:a;
 const project=projects.find(p=>String(p.id)===String(projectId));
 const relevant=(observations||[]).filter(o=>!projectId||String(o.project_id)===String(projectId));
 const open=relevant.filter(o=>!['closed','resolved','completed'].includes(String(o.status||'open').toLowerCase()));
 const panel=doc.createElement('aside');panel.id='ge-desktop-command';
 panel.setAttribute('aria-label',tr('Safety command panel','Panel de operaciones Safety'));
 const title=doc.createElement('h2');title.textContent='SAFETY COMMAND';panel.append(title);
 const section=(heading)=>{const box=doc.createElement('section');box.className='ge-command-section';const h=doc.createElement('h3');h.textContent=heading;box.append(h);panel.append(box);return box;};
 const job=section(tr('Active Jobsite','Proyecto activo'));
 const jobName=doc.createElement('strong');jobName.textContent=project?.name||tr('Select a project','Seleccione un proyecto');job.append(jobName);
 const connection=doc.createElement('small');connection.className='ge-command-connection';connection.textContent=doc.defaultView?.navigator?.onLine===false?tr('Offline','Sin conexión'):tr('Online','Conectado');job.append(connection);
 const priorities=section(tr('Safety Priorities','Prioridades de seguridad'));
 const count=doc.createElement('strong');count.className='ge-command-count';count.textContent=String(open.length);priorities.append(count);
 const caption=doc.createElement('span');caption.textContent=tr('Open observations','Observaciones abiertas');priorities.append(caption);
 const list=doc.createElement('ul');list.className='ge-command-list';
 for(const observation of open.slice(0,4)){
  const item=doc.createElement('li');item.textContent=String(observation.title||observation.description||observation.location||tr('Open observation','Observación abierta')).slice(0,95);list.append(item);
 }priorities.append(list);
 const actions=section(tr('Quick Actions','Acciones rápidas'));
 for(const [label,page] of [[tr('Daily JHA','JHA diario'),'safetyWalk'],[tr('Observations','Observaciones'),'observations'],[tr('Report Center','Centro de reportes'),'reportCenter']]){
  const button=doc.createElement('button');button.type='button';button.className='ge-command-action';button.textContent=label;button.addEventListener('click',()=>go(page));actions.append(button);
 }
 const foot=doc.createElement('small');foot.className='ge-command-note';foot.textContent=tr('Based on loaded jobsite data. Open modules for the latest records.','Basado en los datos cargados. Abra los módulos para ver los registros más recientes.');panel.append(foot);
 const main=doc.querySelector('#app > main');main.after(panel);
 const toggle=doc.createElement('button');toggle.type='button';toggle.id='ge-command-toggle';toggle.textContent='◧';toggle.title=tr('Show or hide command panel','Mostrar u ocultar panel');
 toggle.setAttribute('aria-label',toggle.title);
 const key='ge_one_desktop_command_collapsed';let collapsed=false;
 try{collapsed=doc.defaultView?.localStorage?.getItem(key)==='true'}catch{}
 const apply=()=>{doc.documentElement.dataset.geCommandCollapsed=String(collapsed);toggle.setAttribute('aria-expanded',String(!collapsed));};
 toggle.addEventListener('click',()=>{collapsed=!collapsed;try{doc.defaultView?.localStorage?.setItem(key,String(collapsed))}catch{}apply();});
 panel.before(toggle);apply();
}
