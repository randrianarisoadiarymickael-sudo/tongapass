import { useId, useState } from 'react';
import { IconBars, IconTable } from '@/components/icons';
import { cn } from '@/lib/cn';
import { formatMonth } from '@/lib/format';

interface Point {
  month: string;
  arrivals: number;
  departures: number;
}

const SERIES = [
  { key: 'arrivals', label: 'Arrivées', color: 'var(--tp-series-arrivals)' },
  { key: 'departures', label: 'Départs', color: 'var(--tp-series-departures)' },
] as const;

const W = 560;
const H = 220;
const PAD = { top: 16, right: 8, bottom: 28, left: 32 };
const BAR = 18; // ≤ 24 px (spécification dataviz)
const GAP = 2; // espace de surface entre barres adjacentes

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => (value / (s * pow)) <= 4) ?? 10;
  return Math.ceil(value / (step * pow)) * step * pow;
}

/** Colonne dont l'extrémité est arrondie (4 px) et la base carrée, ancrée sur l'axe. */
function columnPath(x: number, y: number, width: number, height: number): string {
  if (height <= 0) return '';
  const r = Math.min(4, height, width / 2);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/**
 * Arrivées et départs par mois (colonnes groupées). Couleurs validées avec le script
 * dataviz (clair et sombre) ; le jaune a un contraste < 3:1, d'où la vue tableau
 * et les infobulles systématiques.
 */
export function MovementsChart({ data }: { data: Point[] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();

  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.arrivals, d.departures])));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max].filter((t) => Number.isInteger(t));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const y = (value: number) => PAD.top + plotH - (value / max) * plotH;
  const total = data.reduce((acc, d) => ({ a: acc.a + d.arrivals, d: acc.d + d.departures }), { a: 0, d: 0 });

  return (
    <figure aria-labelledby={titleId} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <figcaption id={titleId} className="text-sm text-ink-2">
          <span className="font-medium text-ink">{total.a} arrivées</span> et{' '}
          <span className="font-medium text-ink">{total.d} départs</span> sur 6 mois
        </figcaption>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ul className="flex items-center gap-4 text-[13px] text-ink-2" aria-label="Légende">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
          <div className="flex rounded-lg border border-line-strong bg-surface p-0.5" role="group" aria-label="Affichage">
            {(['chart', 'table'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-ink-2 transition-colors hover:bg-hover',
                  view === mode && 'bg-brand text-on-brand hover:bg-brand',
                )}
              >
                {mode === 'chart' ? <IconBars className="size-3.5" aria-hidden="true" /> : <IconTable className="size-3.5" aria-hidden="true" />}
                {mode === 'chart' ? 'Graphique' : 'Tableau'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="group" aria-label="Graphique des arrivées et départs par mois (chaque mois est focalisable)">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--tp-line)" strokeWidth={1} strokeDasharray={tick === 0 ? undefined : '3 4'} />
                <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular">
                  {tick}
                </text>
              </g>
            ))}
            {data.map((point, index) => {
              const cx = PAD.left + band * index + band / 2;
              const x0 = cx - BAR - GAP / 2;
              return (
                <g key={point.month}>
                  {hover === index ? (
                    <rect x={PAD.left + band * index + 4} y={PAD.top} width={band - 8} height={plotH} rx={10} fill="var(--tp-brand-soft)" />
                  ) : null}
                  <path d={columnPath(x0, y(point.arrivals), BAR, plotH + PAD.top - y(point.arrivals))} fill={SERIES[0].color} />
                  <path d={columnPath(cx + GAP / 2, y(point.departures), BAR, plotH + PAD.top - y(point.departures))} fill={SERIES[1].color} />
                  <text x={cx} y={H - 8} textAnchor="middle" className={cn('text-[12px] capitalize', hover === index ? 'fill-ink font-semibold' : 'fill-ink-3')}>
                    {formatMonth(point.month)}
                  </text>
                  {/* Zone de survol plus large que les marques, accessible au clavier */}
                  <rect
                    x={PAD.left + band * index}
                    y={PAD.top}
                    width={band}
                    height={plotH + PAD.bottom}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${formatMonth(point.month)} : ${point.arrivals} arrivées, ${point.departures} départs`}
                    onMouseEnter={() => setHover(index)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(index)}
                    onBlur={() => setHover(null)}
                    className="cursor-default outline-none"
                  />
                </g>
              );
            })}
          </svg>
          {hover !== null && data[hover] ? (
            <div
              className="panel-raised pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-lg px-3 py-2 text-[13px]"
              style={{ left: `${((PAD.left + band * hover + band / 2) / W) * 100}%` }}
              role="status"
            >
              <p className="font-semibold capitalize text-ink">{formatMonth(data[hover].month)}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="flex items-center justify-between gap-4 text-ink-2">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-[2px]" style={{ background: s.color }} aria-hidden="true" />
                    {s.label}
                  </span>
                  <span className="font-semibold tabular text-ink">{data[hover][s.key]}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-sunken text-left text-xs font-medium text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Mois</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Arrivées</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Départs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((point) => (
                <tr key={point.month}>
                  <th scope="row" className="px-4 py-2 text-left font-medium capitalize">{formatMonth(point.month)} {point.month.slice(0, 4)}</th>
                  <td className="px-4 py-2 text-right tabular">{point.arrivals}</td>
                  <td className="px-4 py-2 text-right tabular">{point.departures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
