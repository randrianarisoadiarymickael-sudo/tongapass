/** Barre de progression : remplissage plein, transition courte sur la largeur. */
export function ProgressBar({
  value,
  tone = 'success',
  label,
}: {
  value: number;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'brand';
  label: string;
}) {
  const color = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info', brand: 'bg-brand' }[tone];
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-300 ease-out`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
