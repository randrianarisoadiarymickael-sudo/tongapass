import { IconAlert } from '@/components/icons';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AccessMatrix } from '@/components/employee/AccessMatrix';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Feedback';
import { useCatalog, useCreateMobility, useCreateOffboarding, useMobilityPreview, useProfiles, useUpdateEmployee } from '@/hooks/queries';
import { ApiError, errorMessage } from '@/lib/api';
import { DEPARTURE_REASONS } from '@/lib/labels';
import type { EmployeeDetail } from '@/lib/types';

interface DialogBaseProps {
  employee: EmployeeDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Timing = 'now' | 'later';

/** Convertit une valeur `datetime-local` (heure locale du navigateur) en ISO 8601. */
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function localNowPlus(hours: number): string {
  const date = new Date(Date.now() + hours * 3_600_000);
  date.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
}

function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.fieldErrors() : {};
}

// ---------------------------------------------------------------------------
// Départ
// ---------------------------------------------------------------------------

export function OffboardingDialog({ employee, open, onOpenChange }: DialogBaseProps) {
  const create = useCreateOffboarding();
  const [reason, setReason] = useState<string>(employee.contractType === 'STAGE' ? 'END_OF_INTERNSHIP' : 'RESIGNATION');
  const [timing, setTiming] = useState<Timing>('now');
  const [effectiveAt, setEffectiveAt] = useState(() =>
    employee.endDate ? `${employee.endDate}T18:00` : localNowPlus(24),
  );
  const [comment, setComment] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notifyManager, setNotifyManager] = useState(Boolean(employee.managerEmail));
  const errors = fieldErrors(create.error);
  const confirmed = confirm.trim() === employee.username;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed) return;
    try {
      const run = await create.mutateAsync({
        employeeId: employee.id,
        reason,
        comment: comment.trim() || undefined,
        effectiveAt: timing === 'later' ? toIso(effectiveAt) : undefined,
        confirmUsername: confirm.trim(),
        notifyManager,
      });
      toast.success(run.status === 'SCHEDULED' ? 'Départ planifié' : 'Révocation lancée', {
        description:
          run.status === 'SCHEDULED'
            ? 'Les accès restent actifs jusqu’à la date prévue.'
            : 'Les comptes sont désactivés et les sessions fermées.',
      });
      onOpenChange(false);
    } catch (e) {
      toast.error('Départ refusé', { description: errorMessage(e) });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Départ de ${employee.firstName} ${employee.lastName}`}
      description="Désactive le compte Keycloak, ferme les sessions et retire les accès Gitea et Mattermost."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="danger" type="submit" form="offboarding-form" disabled={!confirmed} loading={create.isPending}>
            {timing === 'later' ? 'Planifier la révocation' : 'Révoquer les accès'}
          </Button>
        </>
      }
    >
      <form id="offboarding-form" onSubmit={submit} className="space-y-4">
        <Field label="Motif" error={errors.reason}>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {DEPARTURE_REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="space-y-2">
          <p className="text-[13px] font-medium">Révocation</p>
          <Segmented
            label="Moment de la révocation"
            value={timing}
            onChange={setTiming}
            options={[
              { value: 'now', label: 'Immédiate' },
              { value: 'later', label: 'À une date' },
            ]}
          />
          {timing === 'later' ? (
            <Field label="Date et heure" hint="Les accès restent actifs jusque-là. Vous pourrez annuler ou avancer la révocation." error={errors.effectiveAt}>
              <Input type="datetime-local" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} required />
            </Field>
          ) : null}
        </div>
        <Field label="Commentaire" optional error={errors.comment}>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="Passation, matériel à restituer…" />
        </Field>
        {employee.managerEmail ? (
          <Checkbox
            checked={notifyManager}
            onChange={setNotifyManager}
            label="Envoyer le récapitulatif au manager"
            description={employee.managerEmail}
          />
        ) : null}
        <div className="rounded-md border border-danger/25 bg-danger-soft p-3">
          <p className="flex items-center gap-2 text-[13px] font-medium text-danger">
            <IconAlert className="size-4" />
            Action tracée dans le journal d’audit
          </p>
          <Field
            className="mt-3"
            label={
              <>
                Recopiez l’identifiant <span className="font-mono">{employee.username}</span> pour confirmer
              </>
            }
            error={errors.confirmUsername}
          >
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} translate="no" />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Mobilité interne
// ---------------------------------------------------------------------------

export function MobilityDialog({ employee, open, onOpenChange, sensitive }: DialogBaseProps & { sensitive: Set<string> }) {
  const profiles = useProfiles();
  const catalog = useCatalog();
  const preview = useMobilityPreview(employee.id);
  const create = useCreateMobility(employee.id);
  const [profileId, setProfileId] = useState(employee.accessProfileId);
  const [jobTitle, setJobTitle] = useState(employee.jobTitle);
  const [department, setDepartment] = useState(employee.department);
  const [extraRoles, setExtraRoles] = useState<string[]>(employee.extraRealmRoles);
  const [justification, setJustification] = useState(employee.extraAccessJustification ?? '');
  const [reason, setReason] = useState('');
  const [timing, setTiming] = useState<Timing>('now');
  const [effectiveAt, setEffectiveAt] = useState(() => localNowPlus(24));
  const [notifyManager, setNotifyManager] = useState(Boolean(employee.managerEmail));
  const errors = fieldErrors(create.error);
  const { mutate: runPreview } = preview;

  const extraKey = extraRoles.slice().sort().join(',');
  useEffect(() => {
    const timer = window.setTimeout(() => runPreview({ accessProfileId: profileId, extraRealmRoles: extraKey ? extraKey.split(',') : [] }), 200);
    return () => window.clearTimeout(timer);
  }, [profileId, extraKey, runPreview]);

  const roleOptions = useMemo(() => {
    const target = profiles.data?.find((p) => p.id === profileId);
    return (catalog.data?.realmRoles ?? []).filter((role) => role.value !== 'employee' && !target?.realmRoles.includes(role.value));
  }, [catalog.data, profiles.data, profileId]);

  const result = preview.data;
  const identityChanged = jobTitle.trim() !== employee.jobTitle || department.trim() !== employee.department;
  const nothingChanges = result ? !result.changed && !identityChanged : false;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const run = await create.mutateAsync({
        accessProfileId: profileId,
        jobTitle: jobTitle.trim() !== employee.jobTitle ? jobTitle.trim() : undefined,
        department: department.trim() !== employee.department ? department.trim() : undefined,
        extraRealmRoles: extraRoles,
        extraAccessJustification: extraRoles.length ? justification.trim() : undefined,
        reason: reason.trim() || undefined,
        effectiveAt: timing === 'later' ? toIso(effectiveAt) : undefined,
        notifyManager,
      });
      toast.success(run.status === 'SCHEDULED' ? 'Mobilité planifiée' : 'Mobilité lancée', {
        description: run.status === 'SCHEDULED' ? 'Les droits changeront à la date prévue.' : 'Les droits sont ajustés dans chaque outil.',
      });
      onOpenChange(false);
    } catch (e) {
      toast.error('Mobilité refusée', { description: errorMessage(e) });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Changement de poste · ${employee.firstName} ${employee.lastName}`}
      description="Les droits de l’ancien profil sont retirés, ceux du nouveau ajoutés. Le compte et l’historique sont conservés."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="mobility-form" disabled={nothingChanges} loading={create.isPending}>
            {timing === 'later' ? 'Planifier la mobilité' : 'Appliquer la mobilité'}
          </Button>
        </>
      }
    >
      <form id="mobility-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nouveau profil d’accès" error={errors.accessProfileId} className="sm:col-span-2">
            <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              {(profiles.data ?? []).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                  {profile.id === employee.accessProfileId ? ' (actuel)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Intitulé de poste" error={errors.jobTitle}>
            <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={120} required />
          </Field>
          <Field label="Département" error={errors.department}>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={80} required />
          </Field>
        </div>

        <section aria-labelledby="mobility-diff-title" className="rounded-xl border border-line bg-hover/40">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <h3 id="mobility-diff-title" className="text-[13px] font-semibold">
              Écart de droits
            </h3>
            {result ? (
              <p className="text-xs text-ink-3">
                {result.from.name} → {result.to.name}
              </p>
            ) : null}
          </header>
          <div className="px-4 py-1" aria-live="polite" aria-busy={preview.isPending}>
            {!result ? (
              <Skeleton className="my-3 h-28" />
            ) : !result.changed ? (
              <p className="py-3 text-[13px] text-ink-3">Aucun droit ne change avec ce profil.{identityChanged ? ' Seuls le poste et le département seront mis à jour.' : ''}</p>
            ) : (
              <AccessMatrix access={result.kept} sensitive={sensitive} diff={{ added: result.added, removed: result.removed }} />
            )}
          </div>
          {result?.sensitiveAdded.length ? (
            <p className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-[13px] text-warning">
              <IconAlert className="size-4 shrink-0" />
              Droits sensibles ajoutés : {result.sensitiveAdded.join(', ')}
            </p>
          ) : null}
        </section>

        {roleOptions.length ? (
          <fieldset className="space-y-1">
            <legend className="text-[13px] font-medium">
              Droits supplémentaires <span className="text-xs font-normal text-ink-3">(facultatif, hors profil)</span>
            </legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {roleOptions.map((role) => (
                <Checkbox
                  key={role.value}
                  checked={extraRoles.includes(role.value)}
                  onChange={(checked) =>
                    setExtraRoles((current) => (checked ? [...current, role.value] : current.filter((value) => value !== role.value)))
                  }
                  label={
                    <span translate="no">
                      {role.value}
                      {role.sensitive ? <span className="ml-1.5 text-xs text-warning">sensible</span> : null}
                    </span>
                  }
                  description={role.description}
                />
              ))}
            </div>
          </fieldset>
        ) : null}
        {extraRoles.length ? (
          <Field label="Justification des droits supplémentaires" hint="Au moins 10 caractères. Conservée dans le journal d’audit." error={errors.extraAccessJustification}>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} maxLength={500} required minLength={10} />
          </Field>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[13px] font-medium">Date d’effet</p>
            <Segmented
              label="Date d’effet"
              value={timing}
              onChange={setTiming}
              options={[
                { value: 'now', label: 'Immédiate' },
                { value: 'later', label: 'Planifiée' },
              ]}
            />
            {timing === 'later' ? (
              <Field label="Date et heure" error={errors.effectiveAt}>
                <Input type="datetime-local" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} required />
              </Field>
            ) : null}
          </div>
          <Field label="Motif" optional error={errors.reason}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Promotion, réorganisation…" />
          </Field>
        </div>
        {employee.managerEmail ? (
          <Checkbox checked={notifyManager} onChange={setNotifyManager} label="Informer le manager par e-mail" description={employee.managerEmail} />
        ) : null}
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Modification des informations RH
// ---------------------------------------------------------------------------

export function EditEmployeeDialog({ employee, open, onOpenChange }: DialogBaseProps) {
  const update = useUpdateEmployee(employee.id);
  const [form, setForm] = useState({
    jobTitle: employee.jobTitle,
    department: employee.department,
    location: employee.location ?? '',
    managerName: employee.managerName ?? '',
    managerEmail: employee.managerEmail ?? '',
  });
  const errors = fieldErrors(update.error);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await update.mutateAsync({
        jobTitle: form.jobTitle,
        department: form.department,
        location: form.location || null,
        managerName: form.managerName || null,
        managerEmail: form.managerEmail || null,
      });
      toast.success('Fiche mise à jour');
      onOpenChange(false);
    } catch (e) {
      toast.error('Enregistrement impossible', { description: errorMessage(e) });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Modifier la fiche"
      description="Ces informations n’ont pas d’effet sur les droits. Pour changer de profil d’accès, utilisez « Changer de poste »."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="edit-form" loading={update.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="edit-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Intitulé de poste" error={errors.jobTitle}>
          <Input value={form.jobTitle} onChange={set('jobTitle')} required maxLength={120} />
        </Field>
        <Field label="Département" error={errors.department}>
          <Input value={form.department} onChange={set('department')} required maxLength={80} />
        </Field>
        <Field label="Site" optional error={errors.location} className="sm:col-span-2">
          <Input value={form.location} onChange={set('location')} maxLength={80} />
        </Field>
        <Field label="Manager" optional error={errors.managerName}>
          <Input value={form.managerName} onChange={set('managerName')} maxLength={120} autoComplete="off" />
        </Field>
        <Field label="E-mail du manager" optional error={errors.managerEmail}>
          <Input type="email" value={form.managerEmail} onChange={set('managerEmail')} autoComplete="off" spellCheck={false} />
        </Field>
      </form>
    </Dialog>
  );
}
