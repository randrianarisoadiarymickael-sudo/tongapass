const LOCALE = 'fr-FR';

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const dateLongFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const relativeFmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const numberFmt = new Intl.NumberFormat(LOCALE);

/** « 2026-12-01 » est une date civile : on l'interprète à midi local pour éviter les décalages de fuseau. */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
}

export const formatDate = (value: string | Date | null | undefined) => (value ? dateFmt.format(toDate(value)) : '—');
export const formatDateLong = (value: string | Date) => dateLongFmt.format(toDate(value));
export const formatDateTime = (value: string | Date | null | undefined) =>
  value ? dateTimeFmt.format(toDate(value)) : '—';
export const formatTime = (value: string | Date) => timeFmt.format(toDate(value));
export const formatMonth = (yyyyMm: string) => monthFmt.format(new Date(`${yyyyMm}-15T12:00:00`)).replace('.', '');
export const formatNumber = (value: number) => numberFmt.format(value);

export function formatRelative(value: string | Date | null | undefined, now = Date.now()): string {
  if (!value) return '—';
  const diff = toDate(value).getTime() - now;
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return relativeFmt.format(Math.round(diff / ms), unit);
  }
  return 'à l’instant';
}

/** Durée lisible : 74 → « 1 min 14 s ». */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}\u00a0s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes < 60) return rest ? `${minutes}\u00a0min ${rest}\u00a0s` : `${minutes}\u00a0min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}\u00a0h ${minutes % 60}\u00a0min`;
}

export function durationBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return (new Date(end).getTime() - new Date(start).getTime()) / 1000;
}

export function initials(first: string, last: string): string {
  return `${first.trim()[0] ?? ''}${last.trim()[0] ?? ''}`.toUpperCase();
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
