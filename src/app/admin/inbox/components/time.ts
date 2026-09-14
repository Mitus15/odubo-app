/** "2m", "3h", "Tue", "Sep 4": the age of a message, the way a phone shows it. */
export function timeAgo(iso: string): string {
  const then = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso.replace(' ', 'T')}Z`).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return new Date(then).toLocaleDateString(undefined, { weekday: 'short' });
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fullTime(iso: string): string {
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
