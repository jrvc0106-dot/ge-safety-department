export const TEAM_ROLES = Object.freeze([
  { value: 'worker', en: 'Worker', es: 'Trabajador' },
  { value: 'supervisor', en: 'Supervisor', es: 'Supervisor' },
  { value: 'superintendent', en: 'Superintendent', es: 'Superintendente' },
  { value: 'safety', en: 'Safety', es: 'Safety' },
  { value: 'safety_director', en: 'Safety Director', es: 'Director de Safety' }
]);

const ROLE_LABELS = Object.freeze({
  admin: { en: 'Administrator', es: 'Administrador' },
  ...Object.fromEntries(TEAM_ROLES.map(({value,en,es}) => [value,{en,es}]))
});

export function teamRoleLabel(role, tr = (english) => english) {
  const label = ROLE_LABELS[role];
  return label ? tr(label.en, label.es) : String(role || '').replaceAll('_', ' ');
}

export function isAssignableTeamRole(role) {
  return TEAM_ROLES.some(item => item.value === role);
}
