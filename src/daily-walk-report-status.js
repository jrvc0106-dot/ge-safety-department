export function effectiveWalkStatus(selectedStatus, items = []) {
  const rows = Array.isArray(items) ? items : [];
  const hasOpenUnsafe = rows.some(
    item => item?.status === 'unsafe' && !String(item.correction || '').trim()
  );
  if (selectedStatus === 'unsafe' || hasOpenUnsafe) return 'unsafe';
  if (
    selectedStatus === 'needs_attention' ||
    rows.some(item => item?.status === 'unsafe') ||
    rows.some(item => !['safe', 'unsafe', 'na'].includes(item?.status))
  ) return 'needs_attention';
  return 'safe';
}
