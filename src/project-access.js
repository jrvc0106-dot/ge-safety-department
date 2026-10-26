export async function renderProjectAccess({db,state,frame,tr,esc,captureView,load,navigate,confirmAction,error,documentRef,windowRef}){
 if(!['admin','safety_director'].includes(state.profile?.role)){navigate('home',null,{replace:true});return}
 const isCurrent=captureView();
 const result=await db.rpc('get_project_access_data');
 if(!isCurrent())return;
 if(result.error){error(result.error);return}
 const projects=result.data?.projects||[],members=result.data?.members||[],assigned=new Map(),futureAccess=new Set(result.data?.all_future||[]);
 for(const row of result.data?.memberships||[]){const ids=assigned.get(row.user_id)||[];ids.push(row.project_id);assigned.set(row.user_id,ids)}
 frame(`<section class="project-access-page">
  <button type="button" class="secondary" id="project-access-back" ${state.projects.length?'':'disabled'}>← ${tr('Back','Atrás')}</button>
  <header class="project-access-heading"><div><small>${tr('TEAM PERMISSIONS','PERMISOS DEL TEAM')}</small><h1>${tr('Project access','Acceso a proyectos')}</h1><p>${tr('Each team member can access only the projects selected here. Their reports, photos and evidence follow the same access.','Cada miembro puede acceder solo a los proyectos seleccionados aquí. Sus reportes, fotos y evidencias respetan el mismo acceso.')}</p></div></header>
  <div class="project-access-note">${tr('Check each jobsite this person may access, then select Save access. Unchecked jobsites are not authorized.','Marque los jobsites autorizados para esta persona y pulse Guardar acceso. Los no marcados quedan sin autorización.')}</div>
  ${projects.length&&members.length?`<label class="project-access-picker-label" for="project-access-member-select">${tr("Choose a team member","Seleccione un miembro del equipo")}</label><select id="project-access-member-select" class="project-access-member-select">${members.map(m=>`<option value="${esc(m.id)}">${esc(m.name||m.email)} · ${esc((m.role||"worker").replaceAll("_"," "))}</option>`).join("")}</select><div class="project-access-members">${members.map(member=>{
   const ids=new Set(assigned.get(member.id)||[]),isAdmin=member.role==='admin',hasFutureAccess=futureAccess.has(member.id);
   const options=projects.map(project=>`<label class="project-access-option"><input type="checkbox" data-project-id="${esc(project.id)}" ${ids.has(project.id)?'checked':''}><span>${esc(project.name)}</span>${project.status==='inactive'?`<small>${tr('Inactive','Inactivo')}</small>`:''}</label>`).join('');
   return `<article class="project-access-member" data-member-id="${esc(member.id)}" data-member-role="${esc(member.role||'worker')}"><header><div class="project-access-avatar">${esc((member.name||member.email||'?').trim().charAt(0).toUpperCase())}</div><div class="project-access-identity"><strong>${esc(member.name||member.email)}</strong><span>${esc(member.email||'')}</span><small>${esc((member.role||'worker').replaceAll('_',' '))}${member.position?' · '+esc(member.position):''}</small></div><strong class="project-access-summary" data-project-summary>${isAdmin?tr('All projects','Todos los proyectos'):tr('Loading selection…','Cargando selección…')}</strong></header>${isAdmin?`<p class="project-access-admin-note">${tr('Admin accounts already have full project access.','Las cuentas Admin ya tienen acceso completo a los proyectos.')}</p>`:`<fieldset class="project-access-fieldset" ${projects.length?'':'disabled'}><legend>${tr('Projects this member can access','Proyectos a los que puede acceder')}</legend><div class="project-access-options">${options}</div><label class="project-access-all"><input type="checkbox" data-all-projects ${hasFutureAccess?'checked':''}><span>${tr('Include ALL jobsites, even future ones','Incluir TODOS los jobsites, incluso los futuros')}</span></label></fieldset><footer><button type="button" class="secondary project-access-save" data-save-access>${tr('Save access','Guardar acceso')}</button><span class="project-access-status" role="status" aria-live="polite"></span></footer>`}</article>`
  }).join('')}</div>`:`<div class="empty-state">${projects.length?tr('No active team members were found.','No se encontraron miembros activos del Team.'):tr('No projects are available yet.','Todavía no hay proyectos disponibles.')}</div>`}
 </section>`);
 const back=documentRef.querySelector('#project-access-back');if(back){back.disabled=false;back.onclick=()=>navigate('admin')};
 const cards=[...documentRef.querySelectorAll('.project-access-member')];
 const picker=documentRef.querySelector('#project-access-member-select');
 const showSelectedMember=()=>{for(const card of cards)card.hidden=Boolean(picker&&card.dataset.memberId!==picker.value)};
 if(picker){picker.onchange=showSelectedMember;showSelectedMember()}
 const selectedIds=card=>[...card.querySelectorAll('[data-project-id]:checked')].map(input=>input.dataset.projectId).sort();
 const sync=card=>{
  const boxes=[...card.querySelectorAll('[data-project-id]')],checked=boxes.filter(input=>input.checked).length,all=card.querySelector('[data-all-projects]'),summary=card.querySelector('[data-project-summary]'),save=card.querySelector('[data-save-access]'),perpetual=card.dataset.allFuture==='true';
  if(card.dataset.memberRole==='admin'){if(summary)summary.textContent=tr('All projects','Todos los proyectos');return}
  if(all){all.checked=perpetual;all.indeterminate=false}
  if(summary)summary.textContent=perpetual?tr('All projects + future','Todos los proyectos + futuros'):checked===projects.length&&projects.length?tr('All current projects','Todos los proyectos actuales'):checked===0?tr('No project access','Sin acceso a proyectos'):checked===1?tr('1 project','1 proyecto'):tr(`${checked} projects`,`${checked} proyectos`);
  if(save){const current=JSON.stringify(selectedIds(card)),original=card.dataset.originalProjects||'[]';save.disabled=current===original&&card.dataset.allFuture===card.dataset.originalAllFuture;}
 };
 for(const card of cards){card.dataset.originalProjects=JSON.stringify((assigned.get(card.dataset.memberId)||[]).slice().sort());card.dataset.allFuture=String(futureAccess.has(card.dataset.memberId));card.dataset.originalAllFuture=card.dataset.allFuture;const all=card.querySelector('[data-all-projects]');if(all)all.onchange=()=>{card.dataset.allFuture=String(all.checked);card.querySelectorAll('[data-project-id]').forEach(input=>{input.checked=all.checked});sync(card)};card.querySelectorAll('[data-project-id]').forEach(input=>input.onchange=()=>{card.dataset.allFuture='false';sync(card)});sync(card)}
 for(const button of documentRef.querySelectorAll('[data-save-access]'))button.onclick=async()=>{
  const card=button.closest('.project-access-member'),memberId=card?.dataset.memberId,ids=card?selectedIds(card):[],status=card?.querySelector('.project-access-status');
  if(!memberId||button.disabled)return;
  if(!ids.length&&!windowRef.confirm(tr('Remove this member from every project? They will no longer see project reports or evidence.','¿Retirar a este miembro de todos los proyectos? Ya no podrá ver reportes ni evidencias de los proyectos.')))return;
  button.disabled=true;if(status)status.textContent=tr('Saving…','Guardando…');
  try{
   const result=await db.rpc('set_member_project_access_mode',{p_member_id:memberId,p_project_ids:ids,p_all_future:card.dataset.allFuture==='true'});
   if(result.error)throw result.error;
   const saved=Array.isArray(result.data)?result.data[0]:result.data;
   if(!saved||saved.ok!==true)throw Error(tr('The project access change was not confirmed.','No se confirmó el cambio de acceso a proyectos.'));
   card.dataset.originalProjects=JSON.stringify(ids);card.dataset.originalAllFuture=card.dataset.allFuture;
   if(status)status.textContent=tr('Access saved.','Acceso guardado.');
   confirmAction(tr('Project access updated.','Acceso al proyecto actualizado.'));
   if(memberId===state.profile.id){await load()}
   sync(card);
  }catch(err){if(status)status.textContent=err?.message||String(err);else error(err)}
  finally{sync(card)}
 };
}
