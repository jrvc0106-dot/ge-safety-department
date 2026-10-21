// Keep all unresolved observations visible in Today’s Priorities, including jobsites
// other than the currently selected project. The database RLS limits access.
export function showTodayPrioritiesObservations({
  db, state, tr, fmt, openObservation, loadProjectObservations,
  isCurrent, documentRef = document, reportError
}) {
  const panel = documentRef.querySelector('.command-center');
  const section = documentRef.querySelector('.home-open-observations');
  const list = section?.querySelector('.home-open-list');
  if (!panel || !section || !list) return;

  // Place the existing observation list INSIDE Today’s Priorities, without changing
  // the four priority indicators or any other home modules.
  panel.appendChild(section);
  const heading = section.querySelector('.home-open-heading small');
  if (heading) heading.textContent = tr('Unresolved observations across your accessible jobsites', 'Observaciones pendientes de los jobsites a los que tienes acceso');
  const seeAll = section.querySelector('#home-open-all');
  if (seeAll) seeAll.textContent = tr('View selected jobsite', 'Ver jobsite seleccionado') + ' ›';

  const showMessage = message => {
    list.replaceChildren();
    const p = documentRef.createElement('p');
    p.className = 'home-open-empty';
    p.textContent = message;
    list.append(p);
  };

  showMessage(tr('Loading pending observations…', 'Cargando observaciones pendientes…'));
  const projects = new Map((state.projects || []).map(project => [project.id, project.name]));
  const projectIds = [...projects.keys()];
  if (!projectIds.length) {
    showMessage(tr('No jobsites assigned.', 'No hay jobsites asignados.'));
    return;
  }

  void (async () => {
    try {
      const { data, error } = await db.from('observations')
        .select('id,project_id,status,priority,description,category,area,created_at,assignee:profiles!observations_assigned_to_fkey(name)')
        .in('project_id', projectIds)
        .in('status', ['open', 'pending_verification'])
        .order('created_at', { ascending: false })
        .limit(1000);
      if (!isCurrent()) return;
      if (error) throw error;

      const rank = { critical: 4, high: 3, medium: 2, low: 1 };
      const observations = (data || []).sort((a, b) =>
        (rank[b.priority] || 0) - (rank[a.priority] || 0) ||
        new Date(b.created_at) - new Date(a.created_at)
      );

      const strong = section.querySelector('.home-open-heading strong');
      if (strong) strong.textContent = tr('Pending Observations', 'Observaciones pendientes') + ' (' + observations.length + ')';

      list.replaceChildren();
      if (!observations.length) {
        showMessage(tr('No pending observations in your jobsites.', 'No hay observaciones pendientes en tus jobsites.'));
        return;
      }

      for (const observation of observations) {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'home-open-row';
        const description = documentRef.createElement('span');
        description.className = 'home-open-description';
        const title = documentRef.createElement('b');
        title.textContent = observation.description || observation.category || tr('Safety observation', 'Observación de seguridad');
        const location = documentRef.createElement('small');
        location.textContent =
          (projects.get(observation.project_id) || tr('Jobsite', 'Proyecto')) +
          ' · ' + (observation.area || tr('Location not specified', 'Ubicación no especificada')) +
          (observation.status === 'pending_verification' ? ' · ' + tr('Waiting Safety review', 'Esperando revisión de Safety') : '');
        description.append(title, location);

        const priority = documentRef.createElement('span');
        priority.className = 'home-open-priority ' + (observation.priority || 'low');
        priority.textContent = String(observation.priority || 'low').toUpperCase();
        const assignee = documentRef.createElement('span');
        assignee.className = 'home-open-assignee';
        assignee.textContent = observation.assignee?.name || tr('Unassigned', 'Sin asignar');
        const date = documentRef.createElement('span');
        date.className = 'home-open-date';
        date.textContent = observation.created_at ? fmt(observation.created_at) : '';
        const arrow = documentRef.createElement('span');
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '›';
        button.append(description, priority, assignee, date, arrow);

        button.addEventListener('click', async () => {
          if (!isCurrent() || button.disabled) return;
          button.disabled = true;
          try {
            if (observation.project_id !== state.project) {
              const previousProject = state.project;
              state.project = observation.project_id;
              try {
                await loadProjectObservations(observation.project_id, { force: true });
              } catch (loadError) {
                state.project = previousProject;
                throw loadError;
              }
            }
            if (state.session) openObservation(observation.id);
          } catch (openError) {
            button.disabled = false;
            reportError(openError);
          }
        });
        list.append(button);
      }
    } catch (error) {
      if (isCurrent()) {
        showMessage(tr('Could not load pending observations. Open Observations and try again.', 'No se pudieron cargar las observaciones pendientes. Abra Observaciones e inténtelo de nuevo.'));
        console.warn('[G&E Safety] Today’s Priorities observations', error);
      }
    }
  })();
}
