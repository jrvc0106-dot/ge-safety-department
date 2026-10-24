// G&E ONE: adaptive presentation layer. Data, permissions, navigation and PDFs stay in main.js.
export const DISPLAY_MODE_STORAGE_KEY = 'ge_one_display_mode_v1';
const VALID_PREFERENCES = new Set(['auto', 'mobile', 'desktop']);

export function normalizeDisplayPreference(value) {
  return VALID_PREFERENCES.has(value) ? value : 'auto';
}

export function resolveDisplayMode(preference, viewportWidth) {
  const selected = normalizeDisplayPreference(preference);
  if (selected !== 'auto') return selected;
  return Number.isFinite(viewportWidth) && viewportWidth < 600 ? 'mobile' : 'desktop';
}

export function installMobileExperience({win = window, doc = document} = {}) {
  let preference = 'auto';
  try { preference = normalizeDisplayPreference(win.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY)); }
  catch { /* Private browsing can prohibit storage. Keep the session usable. */ }
  const apply = () => {
    const width = Number(win.innerWidth) || Number(doc.documentElement.clientWidth) || 1024;
    const mode = resolveDisplayMode(preference, width);
    doc.documentElement.dataset.geDisplayPreference = preference;
    doc.documentElement.dataset.geDisplayMode = mode;
    return mode;
  };
  const onResize = () => apply();
  win.addEventListener('resize', onResize, {passive: true});
  win.addEventListener('orientationchange', onResize);
  apply();
  return {
    getPreference: () => preference,
    getMode: () => doc.documentElement.dataset.geDisplayMode,
    setPreference: value => {
      preference = normalizeDisplayPreference(value);
      try { win.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, preference); }
      catch { /* Preserve in-memory selection when storage is disabled. */ }
      return apply();
    },
    refresh: apply,
    dispose: () => {
      win.removeEventListener('resize', onResize);
      win.removeEventListener('orientationchange', onResize);
      delete doc.documentElement.dataset.geDisplayMode;
      delete doc.documentElement.dataset.geDisplayPreference;
    }
  };
}

export function decorateMobileFrame({doc = document, mobile, tr = (en) => en, invitation = false} = {}) {
  if (!mobile) return;
  // main.js renders every page in the existing frame. Extend rather than replace the form.
  const settingsLanguage = doc.getElementById('settings-language');
  if (settingsLanguage && !invitation && !doc.getElementById('ge-display-mode')) {
    const field = doc.createElement('label');
    field.className = 'ge-display-setting';
    field.htmlFor = 'ge-display-mode';
    const heading = doc.createElement('span');
    heading.className = 'ge-display-setting-label';
    heading.textContent = tr('Display Mode', 'Modo de visualización');
    const select = doc.createElement('select');
    select.id = 'ge-display-mode';
    for (const [value, en, es] of [
      ['auto', 'Automatic (recommended)', 'Automático (recomendado)'],
      ['mobile', 'Mobile View', 'Vista móvil'],
      ['desktop', 'Desktop View', 'Vista de computadora']
    ]) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = tr(en, es);
      select.appendChild(option);
    }
    select.value = mobile.getPreference();
    select.addEventListener('change', () => mobile.setPreference(select.value));
    const tip = doc.createElement('small');
    tip.textContent = tr('Automatic adapts to screen width. Your choice is saved on this device.', 'Automático adapta la pantalla a su tamaño. La selección queda guardada en este dispositivo.');
    field.append(heading, select, tip);
    settingsLanguage.closest('label')?.after(field);
  }
  const project = doc.getElementById('home-project');
  if (project && !doc.getElementById('ge-mobile-project-note')) {
    const note = doc.createElement('p');
    note.id = 'ge-mobile-project-note';
    note.className = 'ge-mobile-project-note';
    note.textContent = tr('Your selected project stays active until you change it.', 'El proyecto seleccionado permanece activo hasta que lo cambie.');
    project.after(note);
  }
  const nav = doc.querySelector('.mobile-bottom');
  if (nav) {
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', tr('Mobile navigation', 'Navegación móvil'));
  }
}
