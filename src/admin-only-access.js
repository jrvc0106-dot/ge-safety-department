export const ADMIN_ONLY_PAGES = Object.freeze(new Set(['admin','manageProjects','cloudBackup']));

export function canAccessAdminOnlyPage(role){
  return role === 'admin';
}

export function adminOnlyAccessMessage(tr){
  return tr('Restricted Access: Administrators Only','Acceso Restringido Solo Para Administradores');
}
