import {deviceKindFromWindow} from './report-device-pdf.js';
import {attachMobileFieldGuide} from './mobile-field-workflow.js';
// G&E ONE: adaptive presentation layer. Data, permissions, navigation and PDFs stay in main.js.
export const DISPLAY_MODE_STORAGE_KEY = 'ge_one_display_mode_v1';
const VALID_PREFERENCES = new Set(['auto']);

export function normalizeDisplayPreference(value) {
  return VALID_PREFERENCES.has(value) ? value : 'auto';
}

export function resolveDisplayMode(preference, viewportWidth, phoneLike = false) {
  const selected = normalizeDisplayPreference(preference);
  // GE ONE is tablet-only: always use the adaptive tablet layout.
  return 'desktop';
}

export function installMobileExperience({win = window, doc = document} = {}) {
  let preference = 'auto';
  try { win.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, 'auto'); }
  catch { /* Private browsing can prohibit storage. */ }
  const apply = () => {
    const width = Number(win.innerWidth) || Number(doc.documentElement.clientWidth) || 1024;
    // Keep a phone in mobile mode after rotating to landscape; iPads stay responsive by width.
    const screen = win.screen || {};
    const shortestSide = Math.min(Number(screen.width) || 9999, Number(screen.height) || 9999);
    const coarse = Boolean(win.matchMedia?.('(any-pointer: coarse)').matches);
    const phoneLike = win.navigator?.userAgentData?.mobile === true || (coarse && shortestSide < 600);
    const mode = resolveDisplayMode(preference, width, phoneLike);
    doc.documentElement.dataset.geDisplayPreference = preference;
    doc.documentElement.dataset.geDisplayMode = mode;
    doc.documentElement.dataset.geReportDevice = deviceKindFromWindow(win);
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
      delete doc.documentElement.dataset.geReportDevice;
      delete doc.documentElement.dataset.geDisplayPreference;
    }
  };
}

export function decorateMobileFrame({doc = document, mobile, tr = (en) => en, invitation = false} = {}) {
  if (!mobile) return;
  attachMobileFieldGuide({doc, tr});
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
    const option = doc.createElement('option');
    option.value = 'auto';
    option.textContent = tr('Automatic (recommended)', 'Automático (recomendado)');
    select.appendChild(option);
    select.disabled = true;
    select.value = mobile.getPreference();
    select.addEventListener('change', () => mobile.setPreference(select.value));
    const tip = doc.createElement('small');
    tip.textContent = tr('Tablet layout adjusts automatically to the screen and orientation.', 'El diseño de tablet se ajusta automáticamente a la pantalla y orientación.');
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
