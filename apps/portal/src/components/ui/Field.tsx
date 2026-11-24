import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { IconChevronDown } from '@/components/icons';
import { cn } from '@/lib/cn';

const control =
  'rounded-lg border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-3 sm:text-sm ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-ink-3/60 ' +
  'focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20 disabled:bg-sunken disabled:text-ink-3';

/** Largeur pleine par défaut, sauf si l'appelant fixe une largeur (w-40…) : pas de conflit de classes. */
const fullWidth = (className?: string) => (className && /(^|\s)(\w+:)*w-/.test(className) ? undefined : 'w-full');

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, 'h-10', fullWidth(className), className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <span className={cn('relative block', className)}>
      <select ref={ref} className={cn(control, 'h-10 w-full cursor-pointer appearance-none pr-9')} {...props}>
        {children}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
    </span>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(control, 'min-h-20 py-2 leading-relaxed', fullWidth(className), className)} {...props} />;
});

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}

/** Libellé + contrôle + aide + erreur, reliés pour les lecteurs d'écran. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const child = isValidElement(children)
    ? cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
    : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-[13px] font-medium text-ink">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-ink-3">(facultatif)</span> : null}
      </label>
      {child}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Récapitulatif des erreurs après une validation refusée : placé en tête du formulaire,
 * il reçoit le focus et chaque lien amène au champ à corriger. Les erreurs restent aussi
 * affichées sous chaque champ.
 */
export const ErrorSummary = forwardRef<HTMLDivElement, { items: { name: string; label: string }[]; onSelect: (name: string) => void }>(
  function ErrorSummary({ items, onSelect }, ref) {
    const id = useId();
    if (items.length === 0) return null;
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        aria-labelledby={`${id}-title`}
        className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-danger/25"
      >
        <p id={`${id}-title`} className="font-medium text-danger">
          {items.length === 1 ? '1 champ à corriger' : `${items.length} champs à corriger`}
        </p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {items.map((item) => (
            <li key={item.name}>
              <button
                type="button"
                onClick={() => onSelect(item.name)}
                className="text-ink underline decoration-danger/40 underline-offset-2 transition-colors hover:decoration-danger"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);

/** Case à cocher avec libellé et description, zone cliquable entière. */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 rounded-lg py-1 text-sm', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong accent-[var(--tp-brand)]"
      />
      <span>
        <span className="block text-ink">{label}</span>
        {description ? <span className="block text-xs text-ink-3">{description}</span> : null}
      </span>
    </label>
  );
}
