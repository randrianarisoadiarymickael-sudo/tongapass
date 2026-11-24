import { Dialog as RadixDialog } from 'radix-ui';
import { IconClose } from '@/components/icons';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  /** « alertdialog » pour une confirmation qui interrompt l'utilisateur. */
  role?: 'dialog' | 'alertdialog';
}

/**
 * Fenêtre modale accessible (Radix) : focus piégé, Échap, retour du focus à l'élément d'origine.
 * Un élément marqué data-autofocus reçoit le focus à l'ouverture (sinon le premier champ).
 * Entrée 180 ms, sortie 120 ms.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', role = 'dialog' }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#1c1613]/45 data-[state=open]:animate-[fade-in_var(--duration-base)_ease-out] data-[state=closed]:animate-[fade-out_var(--duration-fast)_ease-in]" />
        <RadixDialog.Content
          role={role}
          onOpenAutoFocus={(event) => {
            const target = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-autofocus]');
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,780px)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'panel-raised overflow-hidden rounded-[var(--radius-panel)] overscroll-contain',
            'data-[state=open]:animate-[dialog-in_var(--duration-base)_var(--ease-out)] data-[state=closed]:animate-[dialog-out_var(--duration-fast)_ease-in]',
            size === 'md' ? 'max-w-lg' : 'max-w-2xl',
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div className="space-y-1">
              <RadixDialog.Title className="text-base font-semibold">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="text-[13px] text-ink-3">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className="-mr-2 inline-flex size-9 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink" aria-label="Fermer">
              <IconClose className="size-4" />
            </RadixDialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-hover px-6 py-3.5">{footer}</footer> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
