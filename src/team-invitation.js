export function isTeamInviteActivation(search = '', hash = '') {
  for (const raw of [search, hash]) {
    const params = new URLSearchParams(String(raw).replace(/^[?#]/, ''));
    if (['invite', 'magiclink'].includes(params.get('type'))) return true;
  }
  return false;
}
