import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useCancelRun, useRunNow } from '@/hooks/queries';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { RunType } from '@/lib/types';

interface ScheduledRun {
  id: string;
  type: RunType;
  scheduledFor: string | null;
}

const TEXT: Record<RunType, { runNow: string; cancel: string }> = {
  ONBOARDING: { runNow: 'Créer maintenant', cancel: 'Annuler l’arrivée' },
  MOBILITY: { runNow: 'Appliquer maintenant', cancel: 'Annuler la mobilité' },
  OFFBOARDING: { runNow: 'Révoquer maintenant', cancel: 'Annuler le départ' },
};

/** Ce qui se passe réellement côté API quand on annule (voir WorkflowsService.cancelScheduled). */
function cancelConsequence(type: RunType, name: string): { title: string; body: string; keep: string } {
  switch (type) {
    case 'ONBOARDING':
      return {
        title: `Annuler l’arrivée de ${name} ?`,
        body: 'Aucun compte ne sera créé et la fiche passera au statut « Annulée ». Pour revenir en arrière, il faudra déclarer une nouvelle arrivée.',
        keep: 'Garder l’arrivée',
      };
    case 'MOBILITY':
      return {
        title: `Annuler le changement de poste de ${name} ?`,
        body: 'Le profil d’accès, le poste et le service actuels sont conservés. Aucun droit n’est modifié.',
        keep: 'Garder la mobilité',
      };
    case 'OFFBOARDING':
      return {
        title: `Annuler le départ de ${name} ?`,
        body: 'Les accès restent actifs et la fiche repasse au statut « Actif ». Un nouveau départ pourra être déclaré plus tard.',
        keep: 'Garder le départ',
      };
  }
}

/**
 * Actions sur une exécution planifiée : l'avancer à maintenant ou l'annuler.
 * L'annulation et la révocation anticipée sont irréversibles : elles passent par une confirmation
 * qui décrit leur conséquence. Créer les comptes ou appliquer une mobilité plus tôt ne retire
 * rien : ces deux actions partent sans confirmation.
 */
export function ScheduledRunActions({ run, employeeName, compact = false }: { run: ScheduledRun; employeeName: string; compact?: boolean }) {
  const cancel = useCancelRun();
  const runNow = useRunNow();
  const [confirm, setConfirm] = useState<'cancel' | 'revoke' | null>(null);
  const text = TEXT[run.type];
  const consequence = cancelConsequence(run.type, employeeName);

  const doRunNow = async () => {
    try {
      await runNow.mutateAsync(run.id);
      setConfirm(null);
      toast.success('Exécution lancée', { description: 'Les étapes s’affichent au fur et à mesure des signaux de n8n.' });
    } catch (e) {
      toast.error('Lancement impossible', { description: errorMessage(e) });
    }
  };

  const doCancel = async () => {
    try {
      await cancel.mutateAsync(run.id);
      setConfirm(null);
      toast.success('Planification annulée');
    } catch (e) {
      toast.error('Annulation impossible', { description: errorMessage(e) });
    }
  };

  const busy = cancel.isPending || runNow.isPending;

  return (
    <div className="flex shrink-0 justify-end gap-1.5">
      <Button
        size="sm"
        variant={compact ? 'ghost' : 'secondary'}
        loading={runNow.isPending && confirm === null}
        disabled={busy}
        aria-label={compact ? `Exécuter (${text.runNow.toLowerCase()}) : ${employeeName}` : undefined}
        onClick={() => (run.type === 'OFFBOARDING' ? setConfirm('revoke') : void doRunNow())}
      >
        {compact ? 'Exécuter' : text.runNow}
      </Button>
      <Button
        size="sm"
        variant="danger-ghost"
        disabled={busy}
        aria-label={compact ? `${text.cancel} : ${employeeName}` : undefined}
        onClick={() => setConfirm('cancel')}
      >
        {compact ? 'Annuler' : text.cancel}
      </Button>

      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(open) => setConfirm(open ? 'cancel' : null)}
        title={consequence.title}
        confirmLabel={text.cancel}
        cancelLabel={consequence.keep}
        loading={cancel.isPending}
        onConfirm={doCancel}
      >
        <p>{consequence.body}</p>
        {run.scheduledFor ? <p className="text-ink-3">Exécution prévue le {formatDateTime(run.scheduledFor)}.</p> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'revoke'}
        onOpenChange={(open) => setConfirm(open ? 'revoke' : null)}
        title={`Révoquer les accès de ${employeeName} maintenant ?`}
        confirmLabel="Révoquer maintenant"
        cancelLabel="Attendre la date prévue"
        loading={runNow.isPending}
        onConfirm={doRunNow}
      >
        <p>
          Le compte Keycloak est désactivé, les sessions ouvertes sont fermées et les comptes Gitea et Mattermost sont bloqués, sans attendre
          {run.scheduledFor ? ` le ${formatDateTime(run.scheduledFor)}` : ' la date prévue'}.
        </p>
        <p className="font-medium text-ink">Cette action ne peut pas être annulée.</p>
      </ConfirmDialog>
    </div>
  );
}
