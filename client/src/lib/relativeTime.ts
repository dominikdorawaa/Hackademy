export function formatRelativeTimePL(at: number, now = Date.now()) {
  if (Number.isNaN(at)) return '';
  const diffSec = Math.floor((now - at) / 1000);
  if (diffSec < 60) return 'przed chwilą';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h temu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'wczoraj';
  return `${diffDay} dni temu`;
}
