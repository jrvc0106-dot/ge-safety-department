const actionLabels = {
  view: (tr) => tr('View PDF', 'Ver PDF'),
  download: (tr) => tr('Download PDF', 'Descargar PDF'),
  share: (tr) => tr('Share PDF', 'Compartir PDF'),
};

export function pdfActionRetryMessage(action, reason, tr) {
  const label = (actionLabels[action] || (() => tr('PDF action', 'acción del PDF')))(tr);
  const detail = String(reason || '').trim();
  const guidance = tr(
    'The PDF could not be completed. Tap ',
    'No se pudo completar el PDF. Pulsa ',
  ) + label + tr(' again to retry.', ' otra vez para reintentarlo.');
  return detail
    ? guidance + ' ' + tr('Details:', 'Detalle:') + ' ' + detail
    : guidance;
}
