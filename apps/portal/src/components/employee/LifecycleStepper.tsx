import { cn } from '@/lib/cn';
import type { EmployeeStatus } from '@/lib/types';

const STAGES = ['Déclaré', 'Comptes créés', 'Actif', 'Départ', 'Accès révoqués'] as const;

/** Position dans le cycle de vie (0 à 4) et état de l'étape courante. */
function position(status: EmployeeStatus): { index: number; state: 'done' | 'current' | 'error' | 'cancelled' } {
  switch (status) {
    case 'PENDING':
      return { index: 0, state: 'current' };
    case 'PROVISIONING':
      return { index: 1, state: 'current' };
    case 'FAILED':
      return { index: 1, state: 'error' };
    case 'ACTIVE':
      return { index: 2, state: 'done' };
    case 'OFFBOARDING_SCHEDULED':
    case 'OFFBOARDING':
      return { index: 3, state: 'current' };
    case 'DEPARTED':
      return { index: 4, state: 'done' };
    case 'CANCELLED':
      return { index: 0, state: 'cancelled' };
  }
}

/** Frise horizontale du cycle de vie de l'employé : où il en est, d'un coup d'œil. */
export function LifecycleStepper({ status }: { status: EmployeeStatus }) {
  const { index, state } = position(status);
  const progress = state === 'cancelled' ? 0 : (index / (STAGES.length - 1)) * 100;
  const leaving = index >= 3;

  return (
    <div className="relative w-full" role="img" aria-label={`Cycle de vie : ${state === 'cancelled' ? 'arrivée annulée' : STAGES[index]}`}>
      {/* Piste entre le premier et le dernier point (centres de colonnes à 10 % et 90 %) */}
      <div className="absolute left-[10%] right-[10%] top-[7px] h-0.5 bg-line-strong" aria-hidden="true">
        <div className={cn('h-full', state === 'error' || leaving ? 'bg-danger' : 'bg-brand')} style={{ width: `${progress}%` }} />
      </div>
      <ol className="relative grid grid-cols-5 text-center">
        {STAGES.map((label, i) => {
          const reached = state !== 'cancelled' && i <= index;
          const current = i === index;
          const filled = reached && !(current && state === 'current');
          return (
            <li key={label} className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  'relative size-4 rounded-full border-[3px] bg-[var(--tp-solid)]',
                  !reached && 'border-line-strong',
                  filled && (i >= 3 || (current && state === 'error') ? 'border-danger' : 'border-brand'),
                  current && state === 'current' && 'border-info',
                  state === 'cancelled' && i === 0 && 'border-ink-3',
                )}
              />
              <span className={cn('text-xs leading-tight', current ? 'font-semibold text-ink' : reached ? 'font-medium text-ink-2' : 'text-ink-3')}>
                {state === 'cancelled' && i === 0 ? 'Annulé' : label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
