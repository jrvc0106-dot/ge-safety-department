/**
 * Phone-only field navigation and checklist progress for G&E ONE.
 * This is a presentation enhancement: never alter form values, uploads, signatures,
 * save handlers, project selection, or PDF report markup.
 */
const ID = 'ge-mobile-field-guide';

export function jhaChecklistProgress(form) {
  const items = [...(form?.querySelectorAll('.walk-item') || [])];
  const answered = items.filter(item => item.querySelector('.walk-status input[type="radio"]:checked'));
  return {total: items.length, answered: answered.length, remaining: items.length - answered.length};
}

function jumpTo(element) {
  if (!element) return false;
  element.scrollIntoView?.({behavior: 'smooth', block: 'start'});
  const heading = element.matches?.('input,textarea,select') ? element : element.querySelector?.('h2,h3,legend,label,input,textarea,select') || element;
  // Move screen-reader focus to the selected section without opening a phone keyboard.
  const focusTarget = heading?.matches?.('input,textarea,select') ? (heading.closest('label') || element) : heading;
  if (focusTarget?.setAttribute && !focusTarget.hasAttribute('tabindex') && !focusTarget.matches?.('button,a,input,select,textarea')) {
    focusTarget.setAttribute('tabindex', '-1');
  }
  try { focusTarget?.focus?.({preventScroll: true}); } catch { focusTarget?.focus?.(); }
  return true;
}

function guideButton(doc, caption, destination) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'ge-mobile-guide-button';
  button.textContent = caption;
  button.addEventListener('click', () => jumpTo(destination()));
  return button;
}

function progressNode(doc, tr, count) {
  const label = doc.createElement('span');
  label.className = 'ge-mobile-progress-label';
  const progress = doc.createElement('progress');
  progress.className = 'ge-mobile-progress';
  progress.max = Math.max(count.total, 1);
  progress.value = count.answered;
  const status = doc.createElement('span');
  status.className = 'ge-mobile-progress-count';
  status.setAttribute('role', 'status');
  const update = next => {
    progress.max = Math.max(next.total, 1);
    progress.value = next.answered;
    label.textContent = tr('Checklist progress', 'Progreso del checklist');
    status.textContent = tr(
      String(next.answered) + ' of ' + next.total + ' answered',
      String(next.answered) + ' de ' + next.total + ' respondidos'
    );
  };
  update(count);
  return {label, progress, status, update};
}

export function attachMobileFieldGuide({doc = document, tr = en => en} = {}) {
  const form = doc.querySelector('#walk-form,#observation,#quick-orientation-form');
  if (!form || form.querySelector('#' + ID)) return false;
  const guide = doc.createElement('div');
  guide.id = ID;
  guide.className = 'ge-mobile-field-guide';
  guide.setAttribute('aria-label', tr('Field navigation', 'Navegación de campo'));
  const top = doc.createElement('div');
  top.className = 'ge-mobile-field-guide-top';
  const title = doc.createElement('strong');
  title.textContent = tr('Field tools', 'Herramientas de campo');
  top.append(title);
  const links = doc.createElement('div');
  links.className = 'ge-mobile-field-links';

  if (form.id === 'walk-form') {
    const progress = progressNode(doc, tr, jhaChecklistProgress(form));
    top.append(progress.status);
    guide.append(top, progress.label, progress.progress);
    const firstIncomplete = () => [...form.querySelectorAll('.walk-item')].find(item => !item.querySelector('.walk-status input[type="radio"]:checked'));
    links.append(
      guideButton(doc, tr('Next unanswered', 'Siguiente sin responder'), () => firstIncomplete() || form.querySelector('.walk-final')),
      guideButton(doc, tr('Final review & signatures', 'Revisión final y firmas'), () => form.querySelector('.walk-final'))
    );
    const update = () => progress.update(jhaChecklistProgress(form));
    form.addEventListener('change', event => {
      if (event.target?.matches?.('.walk-status input[type="radio"]')) update();
    });
    form.addEventListener('input', event => {
      if (event.target?.matches?.('.walk-status input[type="radio"]')) update();
    });
  } else if (form.id === 'observation') {
    guide.append(top);
    links.append(
      guideButton(doc, tr('Finding', 'Hallazgo'), () => form.querySelector('[name="description"]')?.closest('label')),
      guideButton(doc, tr('Priority & owner', 'Prioridad y responsable'), () => form.querySelector('[name="priority"]')?.closest('label')),
      guideButton(doc, tr('Photos & submit', 'Fotos y envío'), () => form.querySelector('[name="photo"]')?.closest('label'))
    );
  } else {
    guide.append(top);
    links.append(
      guideButton(doc, tr('Employee', 'Empleado'), () => form.querySelector('.quick-employee-grid')),
      guideButton(doc, tr('Face photo', 'Foto del rostro'), () => form.querySelector('.quick-face-id')),
      guideButton(doc, tr('Jobsite hazards', 'Riesgos del sitio'), () => form.querySelector('.quick-hazard-grid')),
      guideButton(doc, tr('Acknowledgment & signatures', 'Confirmación y firmas'), () => form.querySelector('.quick-ack-card'))
    );
  }
  guide.append(links);
  form.prepend(guide);
  return true;
}
