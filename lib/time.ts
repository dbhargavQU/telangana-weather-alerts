export function formatLocalWindow(startUtc: Date | null, hours: number, tz: string = 'Asia/Kolkata'): string {
  try {
    if (!startUtc) return 'later today';
    const start = new Date(startUtc);
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
    const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: tz, hour: 'numeric', hour12: true });
    const s = fmt.format(start); // e.g., "1 am"
    const e = fmt.format(end);   // e.g., "4 am"
    return `${s} – ${e}`; // en dash with spaces
  } catch {
    return 'later today';
  }
}

export function safeRangeFromCenter(centerMin: number | null, plusMinus: number): { from: number | null; to: number | null } {
  if (centerMin == null) return { from: null, to: null };
  const from = Math.max(0, Math.floor(centerMin - plusMinus));
  const to = Math.max(from + 1, Math.ceil(centerMin + plusMinus));
  return { from, to };
}


