const paths = {
  observation: '<path d="M12 3 20 6v5.2c0 5-3.4 8.2-8 10.3-4.6-2.1-8-5.3-8-10.3V6z"/><path d="m8.5 12.3 2.2 2.2 4.8-5"/>',
  observations: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/><path d="M9 2h6"/>',
  corrections: '<circle cx="12" cy="12" r="8.5"/><path d="m8.4 12.1 2.3 2.3 5-5"/>',
  daily_report: '<path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
  cloud_backup: '<path d="M7 18h10a4 4 0 0 0 .2-8 6 6 0 0 0-11.5-1A4.5 4.5 0 0 0 7 18Z"/><path d="M12 16V9m-3 3 3-3 3 3"/>',
  equipment: '<rect x="5" y="4" width="12" height="17" rx="2"/><path d="M9 4V2h4v2M8 9h6M8 13h3"/><circle cx="18" cy="17" r="3"/><path d="M18 12.5v1m0 7v1m4-4.5h-1m-6 0h-1m6.1-3.1-.7.7m-4.8 4.8-.7.7m6.2 0-.7-.7m-4.8-4.8-.7-.7"/>',
  team: '<circle cx="12" cy="8" r="3"/><path d="M5 20c.5-3.1 2.9-5 7-5s6.5 1.9 7 5"/><circle cx="5" cy="10" r="2"/><path d="M1.8 18c.3-1.9 1.4-3 3.3-3.4"/><circle cx="19" cy="10" r="2"/><path d="M22.2 18c-.3-1.9-1.4-3-3.3-3.4"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="m19.4 15 .1.1 1.2.9-1.2 2.1-1.5-.6a8.5 8.5 0 0 1-1.8 1l-.3 1.6h-2.4l-.3-1.6a8.5 8.5 0 0 1-1.8-1l-1.5.6-1.2-2.1 1.2-.9a8.3 8.3 0 0 1 0-2l-1.2-.9 1.2-2.1 1.5.6a8.5 8.5 0 0 1 1.8-1l.3-1.6h2.4l.3 1.6a8.5 8.5 0 0 1 1.8 1l1.5-.6 1.2 2.1-1.2.9a8.3 8.3 0 0 1 0 2Z"/>',
  discipline: '<path d="M7 3h7l4 4v8"/><path d="M14 3v5h5"/><path d="M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/><path d="M8 11h6M8 15h4"/><path d="m18 16 4 7h-8z"/><path d="M18 18.5v1.5m0 1h.01"/>',
  safety_walk: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10l1.5 1.5L13 9M9 16h6"/>',
  incident: '<path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
  inventory: '<path d="m12 3 9 5v9l-9 5-9-5V8z"/><path d="m3 8 9 5 9-5m-9 5v9m-4-16 9 5"/>',
  toolbox: '<path d="M3 5h13a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-4l-4 3v-3H6a3 3 0 0 1-3-3z"/><path d="M10 5V3h5v2m-3 11v-2h8v2m-6 0v4m4-4v4"/>',
  training: '<path d="M6 3h9l4 4v8"/><path d="M15 3v5h5"/><path d="M6 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/><path d="M8 11h7M8 15h5"/><circle cx="18" cy="18" r="4"/><path d="m16.5 18 1 1 2-2"/>',
  safety_net: '<rect x="3" y="3" width="18" height="16" rx="1"/><path d="M9 3v16m6-16v16M3 8h18m-18 6h18"/><path d="m7 19 2 2m8-2-2 2"/>',
  emergency: '<path d="M10 3h4v6h6v4h-6v6h-4v-6H4V9h6z"/><path d="m19 15 4 7h-8z"/><path d="M19 17.5v1.5m0 1h.01"/>',
  director: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 16v-3m5 3V9m5 7V7"/><circle cx="18" cy="18" r="3"/>',
  qr: '<path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/><path d="M8 8h3v3H8zM15 8h2v2h-2zM14 14h3v3h-3zM8 15h2v2H8zM11 12h2v2h-2z"/>',
  medical: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 4V2h6v2M12 8v6m-3-3h6"/><path d="M8 17h4"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M16.5 14v2m3-2v2m-4.5 1.5h6"/>',
  hazard: '<path d="M12 3 22 20H2L12 3Z"/><path d="m13 8-3 5h3l-2 4"/>'
};
export function moduleIcon(name) {
  const artwork = paths[name];
  if (!artwork) return '';
  return `<svg class="module-icon-svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${artwork}</svg>`;
}
export const moduleIconNames = Object.freeze(Object.keys(paths));
