import type { ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Conséquence concrète de l'action, en une ou deux phrases. */
  children: ReactNode;
  /** Libellé du bouton de confirmation : le verbe de l'action, jamais « OK ». */
  confirmLabel: string;
  /** Libellé du bouton de renoncement, qui dit ce qui est conservé. */
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Confirmation d'une action irréversible. Le focus initial va sur le bouton de renoncement
 * (choix sûr par défaut) ; Échap et le clic hors de la fenêtre renoncent aussi.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Revenir',
  tone = 'danger',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (loading ? undefined : onOpenChange(next))}
      title={title}
      role="alertdialog"
      footer={
        <>
          <Button data-autofocus onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </Dialog>
  );
}
