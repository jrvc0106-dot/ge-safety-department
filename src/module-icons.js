const paths = {
  team_access_activity: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="9" r="2.2"/><path d="M5.5 16c.4-1.8 1.4-2.7 3-2.7s2.6.9 3 2.7m2-5h4m-4 3h4m-4 3h2"/>',
  team_field: '<g stroke-width="2.1"><circle cx="12" cy="15.2" r="5.1"/><path d="M12 9.2v1m0 10v1m6.1-6h1m-14.2 0h1m10.5-4.3.7-.7m-8.2 8.2-.7.7m8.2 0-.7-.7m-8.2-8.2-.7-.7"/><path d="M19 7.5A8 8 0 0 0 5 6.5M5 4.2v2.3l2.4-.5M5 17.5A8 8 0 0 0 19 17.5m.1 2.2-.1-2.2-2.2.1"/><circle cx="12" cy="6.8" r="1.8" fill="currentColor"/><circle cx="7.2" cy="8.7" r="1.2" fill="currentColor"/><circle cx="16.8" cy="8.7" r="1.2" fill="currentColor"/><path d="M8.4 13.5c.4-2.1 1.6-3.2 3.6-3.2s3.2 1.1 3.6 3.2m-11.5 1c.2-1.6 1.1-2.5 2.7-2.7m10.4 0c1.6.2 2.5 1.1 2.7 2.7"/></g>',
  ai_support: '<path d="M7 7.5h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-1.5l-3.5 2-3.5-2H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z"/><path d="M9 13h.01M15 13h.01M9.5 16c1.4 1 3.6 1 5 0M12 7.5V5m-2 0h4m5-1 .6-1.5L21 2l-1.4-.6L19 0l-.6 1.4L17 2l1.4.6Z"/>',
  observation: '<path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/>',
  observations: '<path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5Z"/><path d="M14 3.5V8h4M9 12h6m-6 4h6m-6 4h3"/>',
  corrections: '<circle cx="12" cy="12" r="9"/><path d="m7.8 12.2 2.7 2.7 5.8-6.1"/>',
  daily_report: '<path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 12h6m-6 4h6m-6 4h3"/>',
  cloud_backup: '<path d="M6.5 18.5h11a4 4 0 0 0 .5-8 6.2 6.2 0 0 0-11.8-1.3 4.7 4.7 0 0 0 .3 9.3Z"/><path d="M12 16V9m-3 3 3-3 3 3"/>',
  equipment: '<path d="M4 17 14.8 6.2a3.2 3.2 0 0 1 4.5 4.5L8.5 21.5 4 20l-1.5-1.5L4 17Z"/><path d="m13 8 4.5 4.5M4 17l3 1-1 3"/>',
  team: '<circle cx="12" cy="8" r="3"/><path d="M6 20c.5-3 2.5-4.5 6-4.5s5.5 1.5 6 4.5"/><circle cx="5" cy="10" r="2"/><path d="M2 18c.3-1.7 1.2-2.7 2.7-3m14.6 0c1.5.3 2.4 1.3 2.7 3"/><circle cx="19" cy="10" r="2"/>',
  settings: '<path d="M10 2.8h4l.6 2.1a7.5 7.5 0 0 1 1.8 1l2.1-.7 2 3.5-1.6 1.4a8 8 0 0 1 0 2l1.6 1.4-2 3.5-2.1-.7a7.5 7.5 0 0 1-1.8 1l-.6 2.1h-4l-.6-2.1a7.5 7.5 0 0 1-1.8-1l-2.1.7-2-3.5 1.6-1.4a8 8 0 0 1 0-2L3.5 8.7l2-3.5 2.1.7a7.5 7.5 0 0 1 1.8-1L10 2.8Z"/><circle cx="12" cy="11.8" r="3"/>',
  discipline: '<path d="M7 3h7l4 4v5M14 3v5h5M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/><path d="M8.5 12h5m-5 4h3"/><path d="m18 14 4 7h-8l4-7Z"/><path d="M18 16.5v2m0 1h.01"/>',
  safety_walk: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5V2h6v1.5M8.5 10.5l1.5 1.5 2.5-3m-4 7h7m-7 3h4"/>',
  incident: '<path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
  inventory: '<path d="m12 2.8 9 4.8v9.5l-9 4.8-9-4.8V7.6l9-4.8Z"/><path d="m3.5 8.2 8.5 4.6 8.5-4.6M12 12.8v8.5m-4.5-16 8.8 4.8"/>',
  toolbox: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-13 0v3h8v-3"/>',
  training: '<path d="m2.5 8.5 9.5-5 9.5 5-9.5 5-9.5-5Z"/><path d="M6 10.5v5c3.6 2.8 8.4 2.8 12 0v-5M21.5 8.5v6"/>',
  safety_net: '<path d="M4 4h16v13H4z"/><path d="M8 4v13m4-13v13m4-13v13M4 8h16m-16 5h16"/><path d="m7 17 5 4 5-4"/>',
  emergency: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v10m-5-5h10"/><path d="M17 3h4v4m0-4-5 5"/>',
  director: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 16v-3m5 3V9m5 7V7m-10 12h11"/>',
  qr: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/><path d="M7 7h3v3H7zM15 7h2v2h-2zM7 15h2v2H7zM13 13h4v4h-4zM18 11v2m-7 0h1"/>',
  medical: '<path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v13A1.5 1.5 0 0 1 17.5 22h-11A1.5 1.5 0 0 1 5 20.5v-13Z"/><path d="M9 5V3h6v2m-3 5v7m-3.5-3.5h7"/>',
  hazard: '<path d="M12 3 22 20H2L12 3Z"/><path d="m13.2 8.5-3 5h3l-2.4 4"/>'
};
export function moduleIcon(name) {
  const artwork = paths[name];
  if (!artwork) return '';
  return `<svg class="module-icon-svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${artwork}</svg>`;
}
export const moduleIconNames = Object.freeze(Object.keys(paths));
