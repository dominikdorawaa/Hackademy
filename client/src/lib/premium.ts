export function formatUntil(value: string) {
  return new Date(value).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}
