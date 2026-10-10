const instances = new WeakMap();

// Move existing controls, keeping their names, validation and event listeners.
export function simplifyOrientationForm(form, tr) {
  if (!form || instances.has(form)) return instances.get(form);
  const doc = form.ownerDocument, win = doc.defaultView;
  const make = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const section = (number, title, open) => {
    const details = make('details', 'orientation-step');
    details.open = open;
    const summary = make('summary');
    summary.append(make('span', 'orientation-step-number', String(number)), make('span', '', title));
    details.append(summary);
    const body = make('div', 'orientation-step-body');
    details.append(body); form.append(details);
    return {details, body};
  };
  const fields = [...form.children].filter(node => node.matches('label') && !node.querySelector('[name="notes"]'));
  const evidence = form.querySelector('.orientation-evidence-fields');
  const notes = form.querySelector('[name="notes"]')?.closest('label');
  const signatures = form.querySelector('.jha-approval-fields');
  const submit = form.querySelector('button[type="submit"]');
  form.classList.add('orientation-compact');
  const data = section(1, tr('Employee details', 'Datos del empleado'), true);
  data.body.classList.add('orientation-data-grid');
  const order = ['employee_name', 'sticker_number', 'orientation_date', 'employee_company', 'employee_position', 'employee_profile_id'];
  fields.sort((a,b) => order.indexOf(a.querySelector('[name]').name) - order.indexOf(b.querySelector('[name]').name));
  fields.forEach(field => data.body.append(field));
  const photos = section(2, tr('Orientation evidence', 'Evidencia de orientación'), true);
  if (evidence) photos.body.append(evidence);
  // Keep legacy values in the form for existing records, but do not show
  // Notes or Signatures as orientation steps.
  const legacy = make('div', 'orientation-legacy-fields');
  legacy.hidden = true;
  if (notes) legacy.append(notes);
  if (signatures) legacy.append(signatures);
  legacy.querySelectorAll('input, textarea, select').forEach(control => {
    control.required = false;
  });
  form.append(legacy);
  const footer = make('div', 'orientation-save-bar');
  if (submit) footer.append(submit);
  form.append(footer);
  const reveal = node => {
    for (let parent = node?.parentElement; parent && parent !== form; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    node?.focus();
  };
  form.addEventListener('invalid', event => reveal(event.target), true);
  const previews = new Map();
  const release = name => {
    const current = previews.get(name);
    if (!current) return;
    current.urls.forEach(url => win.URL.revokeObjectURL(url));
    current.node.remove(); previews.delete(name);
  };
  const updateEvidence = (name, files) => {
    release(name);
    const count = [...form.querySelectorAll('[data-evidence-count]')].find(node => node.dataset.evidenceCount === name);
    if (!count) return;
    count.textContent = files.length ? tr('Attached', 'Adjunta') + ' · ' + files.length : tr('Pending', 'Pendiente');
    count.dataset.attached = files.length ? 'true' : 'false';
    const list = make('div', 'orientation-photo-previews');
    const urls = [];
    files.forEach(file => {
      const item = make('figure');
      const caption = make('figcaption', '', file.name);
      try {
        const url = win.URL.createObjectURL(file); urls.push(url);
        const img = make('img'); img.src = url; img.alt = file.name;
        img.onerror = () => { img.remove(); };
        item.append(img);
      } catch { /* The filename still identifies HEIC or unsupported previews. */ }
      item.append(caption); list.append(item);
    });
    count.after(list); previews.set(name, {node:list, urls});
  };
  const showMissingEvidence = name => {
    const button = [...form.querySelectorAll('[data-evidence-source]')].find(node => node.dataset.evidenceName === name);
    reveal(button);
    button?.scrollIntoView?.({block:'center', behavior:'smooth'});
  };
  const reset = () => {
    [...previews.keys()].forEach(release);
    form.querySelectorAll('[data-evidence-count]').forEach(node => {
      node.textContent = tr('Pending', 'Pendiente'); node.dataset.attached = 'false';
    });
    form.querySelectorAll('[data-jha-clear]').forEach(button => button.click());
    data.details.open = true; photos.details.open = true;

  };
  form.addEventListener('reset', () => win.queueMicrotask(() => { if (form.isConnected) reset(); }));
  form.querySelectorAll('[data-evidence-count]').forEach(node => updateEvidence(node.dataset.evidenceCount, []));
  const observer = new win.MutationObserver(() => {
    if (form.isConnected) return;
    [...previews.keys()].forEach(release); observer.disconnect(); instances.delete(form);
  });
  observer.observe(doc.body, {childList:true, subtree:true});
  const api = {updateEvidence, showMissingEvidence};
  instances.set(form, api);
  return api;
}
