// Drafts stay on this device and are partitioned by account, project and form.
const FORM_IDS = new Set(['equipment-form', 'incident-form', 'walk-form', 'discipline-form', 'observation', 'correction']);
const PREFIX = 'ge_safety_draft_v1:';
const dbName = 'ge-safety-draft-photos';
let context = () => null;
const active = new WeakMap();
const photoWrites = new Map();

function keyFor(form) {
  const { userId, projectId, detailId } = context() || {};
  return userId && projectId && FORM_IDS.has(form.id)
    ? `${PREFIX}${userId}:${projectId}:${form.id}${form.id === 'correction' ? ':' + detailId : ''}` : null;
}

function openPhotos() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function photoOperation(key, value, remove = false) {
  const database = await openPhotos();
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction('photos', remove || value !== undefined ? 'readwrite' : 'readonly');
      const request = remove ? tx.objectStore('photos').delete(key)
        : value !== undefined ? tx.objectStore('photos').put(value, key)
          : tx.objectStore('photos').get(key);
      let result;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { database.close(); }
}

export function captureFields(form) {
  const fields = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled || el.type === 'file' || el.type === 'submit' || el.type === 'button') continue;
    if (el.type === 'radio' || el.type === 'checkbox') fields[el.name + ':' + el.value] = el.checked;
    else fields[el.name] = el.value;
  }
  return fields;
}

export function restoreFields(form, fields) {
  for (const el of form.elements) {
    if (!el.name || el.type === 'file') continue;
    const choice = el.type === 'radio' || el.type === 'checkbox';
    const field = choice ? el.name + ':' + el.value : el.name;
    if (!Object.hasOwn(fields, field)) continue;
    if (choice) el.checked = fields[field];
    else el.value = fields[field];
  }
}

function status(form, message, warning = false) {
  let indicator = form.querySelector('[data-draft-status]');
  if (!indicator) {
    indicator = document.createElement('p');
    indicator.dataset.draftStatus = '';
    indicator.setAttribute('role', 'status');
    indicator.className = 'draft-status';
    form.prepend(indicator);
  }
  indicator.textContent = message;
  indicator.classList.toggle('draft-warning', warning);
}

const label = (en, es) => context()?.lang === 'es' ? es : en;

function queuePhotoWrite(key, job) {
  const previous = photoWrites.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(job);
  photoWrites.set(key, next);
  void next.finally(() => { if (photoWrites.get(key) === next) photoWrites.delete(key); }).catch(() => {});
  return next;
}

async function savePhotos(form, key, revision) {
  const photos = {};
  for (const input of form.querySelectorAll('input[type="file"][name]')) {
    photos[input.name] = [...input.files];
  }
  await queuePhotoWrite(key, () => photoOperation(key, photos));
  if (active.get(form)?.revision === revision) status(form, label('Draft saved on this device, including photos.', 'Borrador guardado en este dispositivo, incluidas las fotos.'));
}

function save(form) {
  const record = active.get(form);
  if (!record || record.restoring) return;
  const revision = ++record.revision;
  try {
    localStorage.setItem(record.key, JSON.stringify({ fields: captureFields(form), savedAt: new Date().toISOString() }));
    status(form, label('Draft saved on this device. Saving photos…', 'Borrador guardado en este dispositivo. Guardando fotos…'));
  } catch {
    status(form, label('Draft could not be saved. Free device storage and try again.', 'No se pudo guardar el borrador. Libere espacio e intente de nuevo.'), true);
    return;
  }
  clearTimeout(record.timer);
  record.timer = setTimeout(() => savePhotos(form, record.key, revision).catch(() => {
    if (active.get(form)?.revision === revision) status(form, label('Text saved, but photos could not be stored. Reattach photos before leaving.', 'Texto guardado, pero no se pudieron almacenar las fotos. Vuelva a adjuntarlas antes de salir.'), true);
  }), 150);
}

async function attach(form, key) {
  const record = { key, restoring: true, revision: 0, timer: null };
  active.set(form, record);
  try {
    const raw = localStorage.getItem(key);
    const draft = raw && JSON.parse(raw);
    if (draft?.fields) {
      // Equipment checkboxes are built after the equipment type changes.
      const type = form.querySelector('[name="equipment_type"]');
      if (type && draft.fields.equipment_type && type.value !== draft.fields.equipment_type) {
        type.value = draft.fields.equipment_type;
        type.dispatchEvent(new Event('change', { bubbles: true }));
      }
      restoreFields(form, draft.fields);
      form.dispatchEvent(new Event('change', { bubbles: true }));
      for (const [name, files] of Object.entries(await photoOperation(key) || {})) {
        const input = [...form.querySelectorAll('input[type="file"][name]')].find(el => el.name === name);
        if (!input || !files?.length) continue;
        const transfer = new DataTransfer();
        for (const file of files) transfer.items.add(file);
        input.files = transfer.files;
      }
      status(form, label('Draft restored from this device.', 'Borrador recuperado de este dispositivo.'));
    }
  } catch {
    status(form, label('Some draft data could not be restored. Check the fields and photos.', 'No se pudieron recuperar todos los datos. Revise los campos y las fotos.'), true);
  } finally { record.restoring = false; }
  form.addEventListener('input', () => save(form));
  form.addEventListener('change', event => {
    save(form);
    if (event.target.type === 'file') {
      clearTimeout(record.timer);
      const revision = record.revision;
      void savePhotos(form, key, revision).catch(() => status(form, label('Photos could not be saved. Reattach them before leaving.', 'No se pudieron guardar las fotos. Vuelva a adjuntarlas antes de salir.'), true));
    }
  });
}

export function startDrafts(getContext) {
  context = getContext;
  const scan = () => {
    for (const id of FORM_IDS) {
      const form = document.getElementById(id), key = form && keyFor(form);
      if (key && active.get(form)?.key !== key) void attach(form, key);
    }
  };
  new MutationObserver(scan).observe(document.getElementById('app'), { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    for (const id of FORM_IDS) {
      const form = document.getElementById(id);
      if (form && active.has(form)) save(form);
    }
  });
  scan();
}

export function clearDraft(form) {
  const record = active.get(form), key = record?.key || keyFor(form);
  if (!key) return;
  if (record) { clearTimeout(record.timer); active.delete(form); }
  localStorage.removeItem(key);
  void queuePhotoWrite(key, () => photoOperation(key, undefined, true)).catch(() => {});
}
