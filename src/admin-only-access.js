export const ADMIN_ONLY_PAGES = Object.freeze(new Set(['admin','manageProjects','cloudBackup']));

export function canAccessAdminOnlyPage(role,page){
  return page === 'admin' ? ['admin','safety_director'].includes(role) : !ADMIN_ONLY_PAGES.has(page) || role === 'admin';
}

export function adminOnlyAccessMessage(tr){
  return tr('Restricted Access: Administrators Only','Acceso Restringido Solo Para Administradores');
}
