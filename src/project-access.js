export async function renderProjectAccess({db,state,frame,tr,esc,captureView,load,navigate,confirmAction,error,documentRef,windowRef}){
 if(!['admin','safety_director'].includes(state.profile?.role)){navigate('home',null,{replace:true});return}
 const isCurrent=captureView();
 const result=await db.rpc('get_project_access_data');
 if(!isCurrent())return;
 if(result.error){error(result.error);return}
 const projects=result.data?.projects||[],members=result.data?.members||[],assigned=new Map();
 for(const row of result.data?.memberships||[]){const ids=assigned.get(row.user_id)||[];ids.push(row.project_id);assigned.set(row.user_id,ids)}
 frame(`<section class="project-access-page">
  <button type="button" class="secondary" id="project-access-back" ${state.projects.length?'':'disabled'}>← ${tr('Back','Atrás')}</button>
  <header class="project-access-heading"><div><small>${tr('TEAM PERMISSIONS','PERMISOS DEL TEAM')}</small><h1>${tr('Project access','Acceso a proyectos')}</h1><p>${tr('Each team member can access only the projects selected here. Their reports, photos and evidence follow the same access.','Cada miembro puede acceder solo a los proyectos seleccionados aquí. Sus reportes, fotos y evidencias respetan el mismo acceso.')}</p></div></header>
  <div class="project-access-note">${tr('Select one project, several projects, or All Projects. You can change access at any time.','Seleccione un proyecto, varios o Todos los Proyectos. Puede cambiar el acceso cuando lo necesite.')}</div>
  ${projects.length&&members.length?`<div class="project-access-members">${members.map(member=>{
   const ids=new Set(assigned.get(member.id)||[]),isAdmin=member.role==='admin';
   const options=projects.map(project=>`<label class="project-access-option"><input type="checkbox" data-project-id="${esc(project.id)}" ${ids.has(project.id)?'checked':''}><span>${esc(project.name)}</span>${project.status==='inactive'?`<small>${tr('Inactive','Inactivo')}</small>`:''}</label>`).join('');
   return `<article class="project-access-member" data-member-id="${esc(member.id)}" data-member-role="${esc(member.role||'worker')}"><header><div class="project-access-avatar">${esc((member.name||member.email||'?').trim().charAt(0).toUpperCase())}</div><div class="project-access-identity"><strong>${esc(member.name||member.email)}</strong><span>${esc(member.email||'')}</span><small>${esc((member.role||'worker').replaceAll('_',' '))}${member.position?' · '+esc(member.position):''}</small></div><strong class="project-access-summary" data-project-summary>${isAdmin?tr('All projects','Todos los proyectos'):tr('Loading selection…','Cargando selección…')}</strong></header>${isAdmin?`<p class="project-access-admin-note">${tr('Admin accounts already have full project access.','Las cuentas Admin ya tienen acceso completo a los proyectos.')}</p>`:`<fieldset class="project-access-fieldset" ${projects.length?'':'disabled'}><legend>${tr('Projects this member can access','Proyectos a los que puede acceder')}</legend><label class="project-access-all"><input type="checkbox" data-all-projects ${ids.size===projects.length?'checked':''}><span>🌐 ${tr('All Projects','Todos los Proyectos')}</span></label><div class="project-access-options">${options}</div></fieldset><footer><button type="button" class="secondary project-access-save" data-save-access>${tr('Save access','Guardar acceso')}</button><span class="project-access-status" role="status" aria-live="polite"></span></footer>`}</article>`
  }).join('')}</div>`:`<div class="empty-state">${projects.length?tr('No active team members were found.','No se encontraron miembros activos del Team.'):tr('No projects are available yet.','Todavía no hay proyectos disponibles.')}</div>`}
 </section>`);
 const back=documentRef.querySelector('#project-access-back');if(back)back.onclick=()=>{if(state.projects.length)navigate('home')};
 const cards=[...documentRef.querySelectorAll('.project-access-member')];
 const selectedIds=card=>[...card.querySelectorAll('[data-project-id]:checked')].map(input=>input.dataset.projectId).sort();
 const sync=card=>{
  const boxes=[...card.querySelectorAll('[data-project-id]')],checked=boxes.filter(input=>input.checked).length,all=card.querySelector('[data-all-projects]'),summary=card.querySelector('[data-project-summary]'),save=card.querySelector('[data-save-access]');
  if(card.dataset.memberRole==='admin'){if(summary)summary.textContent=tr('All projects','Todos los proyectos');return}
  if(all){all.checked=boxes.length>0&&checked===boxes.length;all.indeterminate=checked>0&&checked<boxes.length}
  if(summary)summary.textContent=checked===projects.length&&projects.length?tr('All projects','Todos los proyectos'):checked===0?tr('No project access','Sin acceso a proyectos'):checked===1?tr('1 project','1 proyecto'):tr(`${checked} projects`,`${checked} proyectos`);
  if(save){const current=JSON.stringify(selectedIds(card)),original=card.dataset.originalProjects||'[]';save.disabled=current===original;}
 };
 for(const card of cards){card.dataset.originalProjects=JSON.stringify((assigned.get(card.dataset.memberId)||[]).slice().sort());const all=card.querySelector('[data-all-projects]');if(all)all.onchange=()=>{card.querySelectorAll('[data-project-id]').forEach(input=>{input.checked=all.checked});sync(card)};card.querySelectorAll('[data-project-id]').forEach(input=>input.onchange=()=>sync(card));sync(card)}
 for(const button of documentRef.querySelectorAll('[data-save-access]'))button.onclick=async()=>{
  const card=button.closest('.project-access-member'),memberId=card?.dataset.memberId,ids=card?selectedIds(card):[],status=card?.querySelector('.project-access-status');
  if(!memberId||button.disabled)return;
  if(!ids.length&&!windowRef.confirm(tr('Remove this member from every project? They will no longer see project reports or evidence.','¿Retirar a este miembro de todos los proyectos? Ya no podrá ver reportes ni evidencias de los proyectos.')))return;
  button.disabled=true;if(status)status.textContent=tr('Saving…','Guardando…');
  try{
   const result=await db.rpc('set_member_project_access',{p_member_id:memberId,p_project_ids:ids});
   if(result.error)throw result.error;
   const saved=Array.isArray(result.data)?result.data[0]:result.data;
   if(!saved||saved.ok!==true)throw Error(tr('The project access change was not confirmed.','No se confirmó el cambio de acceso a proyectos.'));
   card.dataset.originalProjects=JSON.stringify(ids);
   if(status)status.textContent=tr('Access saved.','Acceso guardado.');
   confirmAction(tr('Project access updated.','Acceso al proyecto actualizado.'));
   if(memberId===state.profile.id){await load();if(back)back.disabled=!state.projects.length}
   sync(card);
  }catch(err){if(status)status.textContent=err?.message||String(err);else error(err)}
  finally{sync(card)}
 };
}
