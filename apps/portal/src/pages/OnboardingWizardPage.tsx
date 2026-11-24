import { IconAlert, IconArrowLeft, IconArrowRight, IconCalendar, IconCheck, IconHistory } from '@/components/icons';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useMe } from '@/auth/AuthProvider';
import { AccessMatrix } from '@/components/employee/AccessMatrix';
import { SystemIcon } from '@/components/flow/SystemIcon';
import { Button } from '@/components/ui/Button';
import { DescriptionItem, ErrorState, PageHeader, Panel, Skeleton } from '@/components/ui/Feedback';
import { Checkbox, ErrorSummary, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { useCatalog, useCreateOnboarding, useDepartments, usePreviewOnboarding, useProfiles } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';
import { formatDate, formatDateTime, todayIso } from '@/lib/format';
import { CONTRACT_LABEL } from '@/lib/labels';
import type { ContractType, OnboardingPreview } from '@/lib/types';
import { NoAccess } from './StatusScreens';

interface FormState {
  firstName: string;
  lastName: string;
  personalEmail: string;
  jobTitle: string;
  department: string;
  location: string;
  contractType: ContractType;
  startDate: string;
  endDate: string;
  managerName: string;
  managerEmail: string;
  accessProfileId: string;
  extraRealmRoles: string[];
  extraAccessJustification: string;
  sendWelcomeEmail: boolean;
  announceInChat: boolean;
  scheduleDepartureAtEnd: boolean;
  timing: Timing | null;
  provisionAt: string;
}

type Timing = 'now' | 'eve' | 'custom';

const INITIAL: FormState = {
  firstName: '',
  lastName: '',
  personalEmail: '',
  jobTitle: '',
  department: '',
  location: 'Antananarivo',
  contractType: 'CDI',
  startDate: '',
  endDate: '',
  managerName: '',
  managerEmail: '',
  accessProfileId: '',
  extraRealmRoles: [],
  extraAccessJustification: '',
  sendWelcomeEmail: true,
  announceInChat: true,
  scheduleDepartureAtEnd: true,
  timing: null,
  provisionAt: '',
};

const STEPS = ['Identité', 'Poste et accès', 'Vérification'] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME = /^\p{L}[\p{L}\p{M}' -]*$/u;
const DAY = 86_400_000;

type Errors = Partial<Record<keyof FormState, string>>;

const DRAFT = 'arrivee';

/** Libellés des champs, dans l'ordre d'affichage, pour le récapitulatif des erreurs. */
const FIELD_LABEL: Partial<Record<keyof FormState, string>> = {
  firstName: 'Prénom',
  lastName: 'Nom',
  personalEmail: 'E-mail personnel',
  jobTitle: 'Intitulé du poste',
  department: 'Service',
  contractType: 'Type de contrat',
  location: 'Site',
  startDate: 'Date d’arrivée',
  endDate: 'Fin de contrat',
  managerName: 'Manager',
  managerEmail: 'E-mail du manager',
  accessProfileId: 'Profil d’accès',
  extraAccessJustification: 'Justification',
  provisionAt: 'Date et heure de création des comptes',
};

function errorItems(errors: Errors): { name: string; label: string }[] {
  return (Object.keys(FIELD_LABEL) as (keyof FormState)[])
    .filter((key) => errors[key])
    .map((key) => ({ name: key, label: FIELD_LABEL[key] ?? key }));
}

function timeOf(epoch: number): string {
  return new Date(epoch).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Veille de l'arrivée à 8 h (heure locale) : moment par défaut de la création des comptes. */
function eveOf(startDate: string): Date {
  const date = new Date(`${startDate}T08:00`);
  date.setDate(date.getDate() - 1);
  return date;
}

function resolveProvisionAt(form: FormState, timing: Timing): string | undefined {
  if (timing === 'now') return undefined;
  const date = timing === 'eve' ? eveOf(form.startDate) : new Date(form.provisionAt);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function validate(step: number, form: FormState, timing: Timing): Errors {
  const errors: Errors = {};
  if (step === 0) {
    if (form.firstName.trim().length < 2) errors.firstName = 'Indiquez le prénom (2 caractères minimum)';
    else if (!NAME.test(form.firstName.trim())) errors.firstName = 'Lettres, espaces, tirets et apostrophes uniquement';
    if (form.lastName.trim().length < 2) errors.lastName = 'Indiquez le nom (2 caractères minimum)';
    else if (!NAME.test(form.lastName.trim())) errors.lastName = 'Lettres, espaces, tirets et apostrophes uniquement';
    if (!EMAIL.test(form.personalEmail.trim())) errors.personalEmail = 'Adresse e-mail invalide (ex. prenom.nom@gmail.com)';
  }
  if (step === 1) {
    if (form.jobTitle.trim().length < 2) errors.jobTitle = 'Indiquez l’intitulé du poste';
    if (form.department.trim().length < 2) errors.department = 'Indiquez le service';
    if (!form.startDate) errors.startDate = 'Choisissez la date d’arrivée';
    if ((form.contractType === 'CDD' || form.contractType === 'STAGE') && !form.endDate) {
      errors.endDate = 'La date de fin est requise pour un CDD ou un stage';
    }
    if (form.endDate && form.endDate < form.startDate) errors.endDate = 'La fin doit suivre la date d’arrivée';
    if (form.managerEmail && !EMAIL.test(form.managerEmail.trim())) errors.managerEmail = 'Adresse e-mail invalide';
    if (!form.accessProfileId) errors.accessProfileId = 'Choisissez le profil d’accès correspondant au poste';
    if (form.extraRealmRoles.length && form.extraAccessJustification.trim().length < 10) {
      errors.extraAccessJustification = 'Justifiez les droits supplémentaires (10 caractères minimum)';
    }
  }
  if (step === 2 && timing === 'custom') {
    const at = Date.parse(form.provisionAt);
    if (!form.provisionAt || Number.isNaN(at)) errors.provisionAt = 'Choisissez la date et l’heure de création des comptes';
    else if (at <= Date.now() + 60_000) errors.provisionAt = 'Choisissez une heure à plus d’une minute ou sélectionnez « Maintenant ».';
    else if (at > Date.parse(`${form.startDate}T00:00:00Z`) + 2 * DAY) errors.provisionAt = 'Au plus tard deux jours après l’arrivée';
  }
  if (step === 2 && timing === 'eve' && eveOf(form.startDate).getTime() <= Date.now() + 60_000) {
    errors.provisionAt = 'La veille de l’arrivée est passée. Choisissez un autre moment.';
  }
  return errors;
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex min-w-0 items-center gap-3" aria-label="Progression">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="flex flex-1 items-center gap-3 last:flex-none">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular',
                  done
                    ? 'bg-brand text-on-brand'
                    : active
                      ? 'border-2 border-brand bg-surface text-brand'
                      : 'border border-line-strong bg-surface text-ink-3',
                )}
              >
                {done ? <IconCheck className="size-3.5" strokeWidth={3} aria-hidden="true" /> : index + 1}
              </span>
              <span className={cn('text-[13px] font-semibold', active ? 'text-ink' : done ? 'text-ink-2' : 'text-ink-3', !active && 'sr-only sm:not-sr-only')}>{label}</span>
            </span>
            {index < STEPS.length - 1 ? (
              <span className={cn('h-px flex-1', done ? 'bg-brand' : 'bg-line-strong')} aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function OnboardingWizardPage() {
  useDocumentTitle('Nouvelle arrivée');
  const me = useMe();
  const navigate = useNavigate();
  const profiles = useProfiles();
  const catalog = useCatalog();
  const departments = useDepartments();
  const preview = usePreviewOnboarding();
  const create = useCreateOnboarding();
  // Brouillon de l'onglet : reprise après navigation, rechargement ou reconnexion.
  // L'étape de vérification dépend d'un aperçu calculé par l'API : on reprend au plus à l'étape 2.
  const [restored, setRestored] = useState(() => loadDraft<FormState>(DRAFT));
  const [initial] = useState<FormState>(() => ({ ...INITIAL, startDate: todayIso() }));
  const [step, setStep] = useState(() => restored?.step && restored.step >= 1 ? 1 : 0);
  const [form, setForm] = useState<FormState>(() => ({ ...initial, ...restored?.data }));
  const [errors, setErrors] = useState<Errors>({});
  const [showSummary, setShowSummary] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  // Instant de référence figé à l'ouverture de l'assistant (rendu pur).
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!dirty || create.isSuccess) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, create.isSuccess]);

  // Écriture immédiate (quelques centaines d'octets) : rien n'est perdu si l'on quitte la page aussitôt.
  useEffect(() => {
    if (create.isSuccess || create.isPending) return;
    if (dirty) saveDraft(DRAFT, step, form);
    else clearDraft(DRAFT);
  }, [form, step, dirty, create.isSuccess, create.isPending]);

  const selectedProfile = profiles.data?.find((p) => p.id === form.accessProfileId);
  const extraCandidates = useMemo(
    () => (catalog.data?.realmRoles ?? []).filter((role) => role.value !== 'employee' && !selectedProfile?.realmRoles.includes(role.value)),
    [catalog.data, selectedProfile],
  );

  // La veille n'a de sens que si elle est encore à venir.
  const eveAvailable = eveOf(form.startDate).getTime() > openedAt + 60_000;
  const timing: Timing = form.timing === 'custom' || form.timing === 'now' ? form.timing : eveAvailable ? 'eve' : 'now';
  const provisionAt = resolveProvisionAt(form, timing);
  const hasEnd = Boolean(form.endDate);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  if (!me.permissions.manageEmployees) return <NoAccess what="Seuls les rôles RH et administrateur peuvent déclarer une arrivée." />;

  const focusField = (name: string) => {
    const fields = formRef.current?.querySelectorAll<HTMLElement>(`[name="${name}"]`);
    const target = Array.from(fields ?? []).find((el) => (el as HTMLInputElement).checked) ?? fields?.[0];
    target?.focus();
  };

  /** Une erreur : focus sur le champ. Plusieurs : focus sur le récapitulatif qui les liste. */
  const reportErrors = (found: Errors) => {
    const items = errorItems(found);
    setShowSummary(items.length > 1);
    window.requestAnimationFrame(() => {
      if (items.length > 1) summaryRef.current?.focus();
      else if (items[0]) focusField(items[0].name);
    });
  };

  /** Validation à la sortie d'un champ déjà rempli (un champ vide n'est signalé qu'à la validation de l'étape). */
  const validateOnBlur = (key: keyof FormState) => {
    const value = form[key];
    if (typeof value === 'string' && value.trim() === '') return;
    const message = validate(step, form, timing)[key];
    setErrors((current) => ({ ...current, [key]: message }));
  };

  const restart = () => {
    clearDraft(DRAFT);
    setRestored(null);
    setForm(initial);
    setErrors({});
    setShowSummary(false);
    setStep(0);
  };

  const goToStep = (target: number) => {
    setStep(target);
    setShowSummary(false);
  };

  const next = async () => {
    const found = validate(step, form, timing);
    setErrors(found);
    if (Object.keys(found).length) return reportErrors(found);
    if (step === 1) {
      try {
        await preview.mutateAsync({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          accessProfileId: form.accessProfileId,
          extraRealmRoles: form.extraRealmRoles,
        });
      } catch (error) {
        toast.error('Aperçu impossible', { description: errorMessage(error) });
        return;
      }
    }
    goToStep(Math.min(step + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step < STEPS.length - 1) return void next();
    const found = validate(2, form, timing);
    setErrors(found);
    if (Object.keys(found).length) return reportErrors(found);
    try {
      const run = await create.mutateAsync({
        idempotencyKey: idempotencyKey.current,
        body: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          personalEmail: form.personalEmail.trim(),
          jobTitle: form.jobTitle.trim(),
          department: form.department.trim(),
          location: form.location.trim() || undefined,
          contractType: form.contractType,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          managerName: form.managerName.trim() || undefined,
          managerEmail: form.managerEmail.trim() || undefined,
          accessProfileId: form.accessProfileId,
          extraRealmRoles: form.extraRealmRoles,
          extraAccessJustification: form.extraRealmRoles.length ? form.extraAccessJustification.trim() : undefined,
          provisionAt,
          options: {
            sendWelcomeEmail: form.sendWelcomeEmail,
            announceInChat: form.announceInChat,
            scheduleDepartureAtEnd: hasEnd && form.scheduleDepartureAtEnd,
          },
        },
      });
      clearDraft(DRAFT);
      const name = `${form.firstName.trim()} ${form.lastName.trim()}`;
      if (run.status === 'SCHEDULED') {
        toast.success('Arrivée enregistrée', { description: `Les comptes de ${name} seront créés le ${formatDateTime(run.scheduledFor)}.` });
      } else if (run.status === 'FAILED') {
        toast.warning('Arrivée enregistrée, provisionnement en attente', { description: 'n8n est injoignable : relancez depuis la fiche.' });
      } else {
        toast.success('Arrivée enregistrée', { description: `Création des comptes de ${name} en cours.` });
      }
      navigate(`/executions/${run.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors() as Errors;
        setErrors(fieldErrors);
        // Ramène à l'étape du premier champ refusé par l'API, puis signale les erreurs
        const target = Object.keys(fieldErrors).some((key) => ['firstName', 'lastName', 'personalEmail'].includes(key))
          ? 0
          : Object.keys(fieldErrors).some((key) => key !== 'provisionAt')
            ? 1
            : step;
        if (target !== step) setStep(target);
        if (Object.keys(fieldErrors).length) reportErrors(fieldErrors);
      }
      toast.error('Arrivée non enregistrée', { description: errorMessage(error) });
    }
  };

  const data: OnboardingPreview | undefined = preview.data;
  const summaryItems = showSummary ? errorItems(errors) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Déclarer une arrivée" description="Renseignez la personne et son poste. TongaPass crée ensuite les comptes au moment choisi." />
      <Stepper current={step} />

      {restored ? (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 panel rounded-[var(--radius-panel)] px-4 py-2.5 text-[13px]" role="status">
          <IconHistory className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-ink-2">
            Saisie reprise là où vous l’aviez laissée (brouillon de {timeOf(restored.savedAt)}).
          </p>
          <Button size="sm" variant="ghost" onClick={restart}>
            Recommencer
          </Button>
        </div>
      ) : null}

      <form ref={formRef} onSubmit={submit} noValidate>
        {summaryItems.length ? (
          <ErrorSummary ref={summaryRef} items={summaryItems} onSelect={focusField} />
        ) : null}
        {step < 2 ? <p className={cn('mb-4 text-[13px] text-ink-3', summaryItems.length && 'mt-4')}>Tous les champs sont obligatoires, sauf mention « facultatif ».</p> : null}
        <div key={step} className="step-enter space-y-5">
            {step === 0 ? (
              <Panel title="Identité" description="Sert à générer l’identifiant et l’adresse professionnelle." id="identity">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Prénom" error={errors.firstName}>
                    <Input value={form.firstName} name="firstName" onBlur={() => validateOnBlur('firstName')} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" autoFocus placeholder="Hanitra…" />
                  </Field>
                  <Field label="Nom" error={errors.lastName}>
                    <Input value={form.lastName} name="lastName" onBlur={() => validateOnBlur('lastName')} onChange={(e) => set('lastName', e.target.value)} autoComplete="off" placeholder="Rakotomalala…" />
                  </Field>
                  <Field
                    label="E-mail personnel"
                    error={errors.personalEmail}
                    hint="Reçoit le lien d’activation et l’e-mail de bienvenue."
                    className="sm:col-span-2"
                  >
                    <Input
                      type="email"
                      inputMode="email"
                      value={form.personalEmail}
                      name="personalEmail"
                      onBlur={() => validateOnBlur('personalEmail')}
                      onChange={(e) => set('personalEmail', e.target.value)}
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="prenom.nom@gmail.com"
                    />
                  </Field>
                </div>
              </Panel>
            ) : null}

            {step === 1 ? (
              <>
                <Panel title="Poste et contrat" id="job">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Intitulé du poste" error={errors.jobTitle}>
                      <Input value={form.jobTitle} name="jobTitle" onBlur={() => validateOnBlur('jobTitle')} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Développeuse back-end…" autoFocus />
                    </Field>
                    <Field label="Service" error={errors.department}>
                      <Input value={form.department} name="department" onBlur={() => validateOnBlur('department')} onChange={(e) => set('department', e.target.value)} list="departments" placeholder="Engineering…" />
                    </Field>
                    <datalist id="departments">
                      {['Engineering', 'People', 'Finance', 'Support', 'Marketing', ...(departments.data ?? [])]
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .map((d) => (
                          <option key={d} value={d} />
                        ))}
                    </datalist>
                    <Field label="Type de contrat" error={errors.contractType}>
                      <Select value={form.contractType} name="contractType" onChange={(e) => set('contractType', e.target.value as ContractType)}>
                        {(Object.keys(CONTRACT_LABEL) as ContractType[]).map((type) => (
                          <option key={type} value={type}>
                            {CONTRACT_LABEL[type]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Site" optional error={errors.location}>
                      <Input value={form.location} name="location" onBlur={() => validateOnBlur('location')} onChange={(e) => set('location', e.target.value)} />
                    </Field>
                    <Field label="Date d’arrivée" error={errors.startDate}>
                      <Input type="date" value={form.startDate} name="startDate" onBlur={() => validateOnBlur('startDate')} onChange={(e) => set('startDate', e.target.value)} />
                    </Field>
                    <Field label="Fin de contrat" optional={form.contractType === 'CDI' || form.contractType === 'PRESTATAIRE'} error={errors.endDate}>
                      <Input type="date" value={form.endDate} min={form.startDate} name="endDate" onBlur={() => validateOnBlur('endDate')} onChange={(e) => set('endDate', e.target.value)} />
                    </Field>
                    <Field label="Manager" optional error={errors.managerName}>
                      <Input value={form.managerName} name="managerName" onBlur={() => validateOnBlur('managerName')} onChange={(e) => set('managerName', e.target.value)} placeholder="Toky Andrianina…" />
                    </Field>
                    <Field label="E-mail du manager" optional error={errors.managerEmail} hint="Reçoit les récapitulatifs d’arrivée, de mobilité et de départ.">
                      <Input type="email" value={form.managerEmail} name="managerEmail" onBlur={() => validateOnBlur('managerEmail')} onChange={(e) => set('managerEmail', e.target.value)} spellCheck={false} autoComplete="off" />
                    </Field>
                  </div>
                </Panel>

                <Panel title="Profil d’accès" description="Le minimum nécessaire au poste. Tout droit en plus doit être justifié." id="profile">
                  {profiles.isPending ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : profiles.error ? (
                    <ErrorState error={profiles.error} onRetry={() => void profiles.refetch()} />
                  ) : (
                    <fieldset aria-invalid={errors.accessProfileId ? true : undefined}>
                      <legend className="sr-only">Profil d’accès</legend>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {profiles.data?.map((profile) => {
                          const selected = form.accessProfileId === profile.id;
                          return (
                            <label
                              key={profile.id}
                              className={cn(
                                'relative flex cursor-pointer flex-col gap-1.5 rounded-lg border p-4 transition-colors duration-150',
                                'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-info/25',
                                selected ? 'border-brand bg-brand-soft shadow-[inset_0_0_0_1px_var(--tp-brand)]' : 'border-line bg-surface hover:border-line-strong',
                              )}
                            >
                              <input
                                type="radio"
                                name="accessProfileId"
                                value={profile.id}
                                checked={selected}
                                onChange={() => {
                                  set('accessProfileId', profile.id);
                                  set('extraRealmRoles', []);
                                }}
                                className="sr-only"
                              />
                              <span className="flex items-center gap-2 text-sm font-semibold">
                                <span className="size-2 rounded-full" style={{ background: profile.color }} aria-hidden="true" />
                                {profile.name}
                                {selected ? <IconCheck className="ml-auto size-4 text-brand" aria-hidden="true" /> : null}
                              </span>
                              <span className="text-[13px] leading-snug text-ink-3">{profile.description}</span>
                              <span className="flex flex-wrap gap-1 pt-0.5">
                                {profile.realmRoles.map((role) => (
                                  <span key={role} className="rounded-md border border-line bg-surface px-1.5 font-mono text-[11.5px] leading-5 text-ink-2" translate="no">
                                    {role}
                                  </span>
                                ))}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {errors.accessProfileId ? (
                        <p className="mt-2 text-xs font-medium text-danger" role="alert">
                          {errors.accessProfileId}
                        </p>
                      ) : null}
                    </fieldset>
                  )}

                  {selectedProfile && extraCandidates.length ? (
                    <details className="group mt-4 rounded-xl border border-line bg-hover/40" open={form.extraRealmRoles.length > 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[13px] font-medium">
                        Droits supplémentaires (exception)
                        <span className="text-xs font-normal text-ink-3 group-open:hidden">Afficher</span>
                      </summary>
                      <div className="space-y-3 border-t border-line px-3.5 py-3">
                        <div className="grid gap-x-4 sm:grid-cols-2">
                          {extraCandidates.map((role) => (
                            <Checkbox
                              key={role.value}
                              checked={form.extraRealmRoles.includes(role.value)}
                              onChange={(checked) =>
                                set('extraRealmRoles', checked ? [...form.extraRealmRoles, role.value] : form.extraRealmRoles.filter((r) => r !== role.value))
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
                        {form.extraRealmRoles.length ? (
                          <Field label="Justification" error={errors.extraAccessJustification} hint="Conservée dans le journal d’audit.">
                            <Textarea
                              value={form.extraAccessJustification}
                              name="extraAccessJustification"
                              onBlur={() => validateOnBlur('extraAccessJustification')}
                              onChange={(e) => set('extraAccessJustification', e.target.value)}
                              placeholder="Astreinte de production à partir de janvier…"
                            />
                          </Field>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </Panel>
              </>
            ) : null}

            {step === 2 && data ? (
              <>
                <Panel title="Identité générée" id="review-identity">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                    <DescriptionItem label="Nom">
                      {form.firstName.trim()} {form.lastName.trim()}
                    </DescriptionItem>
                    <DescriptionItem label="Identifiant" mono>
                      {data.identity.username}
                    </DescriptionItem>
                    <DescriptionItem label="E-mail professionnel">{data.identity.workEmail}</DescriptionItem>
                    <DescriptionItem label="Poste">
                      {form.jobTitle} · {form.department}
                    </DescriptionItem>
                    <DescriptionItem label="Arrivée">{formatDate(form.startDate)}</DescriptionItem>
                    <DescriptionItem label="Contrat">
                      {CONTRACT_LABEL[form.contractType]}
                      {form.endDate ? ` jusqu’au ${formatDate(form.endDate)}` : ''}
                    </DescriptionItem>
                  </dl>
                </Panel>

                <Panel title="Accès accordés" description={`Profil « ${data.profile.name} »`} id="review-access">
                  <AccessMatrix access={{ ...data.access, realmRoles: [...data.access.realmRoles, ...data.access.extraRealmRoles] }} sensitive={new Set(data.sensitiveAccess)} />
                  {data.sensitiveAccess.length ? (
                    <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-[13px] text-warning">
                      <IconAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      Droits sensibles inclus : {data.sensitiveAccess.join(', ')}. Ils seront tracés dans le journal d’audit.
                    </p>
                  ) : null}
                </Panel>

                <Panel title="Calendrier" id="review-timing">
                  <div className="space-y-3">
                    <div>
                      <p className="mb-2 text-[13px] font-medium">Création des comptes</p>
                      <Segmented
                        label="Création des comptes"
                        value={timing}
                        onChange={(value) => set('timing', value)}
                        options={[
                          ...(eveAvailable ? [{ value: 'eve' as const, label: 'La veille de l’arrivée' }] : []),
                          { value: 'now', label: 'Maintenant' },
                          { value: 'custom', label: 'Autre date' },
                        ]}
                      />
                      {timing === 'eve' && errors.provisionAt ? <p role="alert" className="mt-2 text-sm text-danger">{errors.provisionAt}</p> : null}
                    </div>
                    {timing === 'custom' ? (
                      <Field label="Date et heure" error={errors.provisionAt} className="max-w-xs">
                        <Input type="datetime-local" value={form.provisionAt} name="provisionAt" onBlur={() => validateOnBlur('provisionAt')} onChange={(e) => set('provisionAt', e.target.value)} />
                      </Field>
                    ) : null}
                    <p className="flex items-center gap-2 text-[13px] text-ink-2">
                      <IconCalendar className="size-4 text-ink-3" aria-hidden="true" />
                      {provisionAt
                        ? `Comptes créés le ${formatDateTime(provisionAt)}. Rien n’est accessible avant cette date.`
                        : timing === 'custom' ? 'Choisissez la date et l’heure de création.' : 'Comptes créés dès la validation.'}
                    </p>
                    {hasEnd ? (
                      <Checkbox
                        className="border-t border-line pt-3"
                        checked={form.scheduleDepartureAtEnd}
                        onChange={(checked) => set('scheduleDepartureAtEnd', checked)}
                        label={`Planifier la révocation des accès le ${formatDate(form.endDate)} à 18 h`}
                        description="Fin de contrat : le départ est préparé automatiquement et reste annulable."
                      />
                    ) : null}
                  </div>
                </Panel>

                <Panel title="Étapes exécutées par n8n" id="review-steps">
                  <ol className="grid gap-1.5 sm:grid-cols-2">
                    {data.steps.map((s, index) => (
                      <li key={s.key} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px]">
                        <SystemIcon system={s.system} className="size-4 text-brand" />
                        <span className="flex-1">
                          <span className="tabular text-ink-3">{index + 1}.</span> {s.label}
                        </span>
                        {s.critical ? <span className="text-xs text-ink-3">bloquante</span> : null}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 grid gap-x-4 border-t border-line pt-3 sm:grid-cols-2">
                    <Checkbox checked={form.sendWelcomeEmail} onChange={(checked) => set('sendWelcomeEmail', checked)} label="Envoyer l’e-mail de bienvenue" />
                    <Checkbox checked={form.announceInChat} onChange={(checked) => set('announceInChat', checked)} label="Annoncer l’arrivée dans ~bienvenue" />
                  </div>
                </Panel>
              </>
            ) : null}
        </div>

        <div className="panel sticky bottom-3 z-10 mt-6 flex items-center justify-between gap-3 rounded-xl px-3 py-3 shadow-overlay">
          {step > 0 ? (
            <Button onClick={() => goToStep(step - 1)} icon={<IconArrowLeft className="size-4" aria-hidden="true" />}>
              Retour
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button variant="primary" type="submit" loading={preview.isPending}>
              Continuer
              <IconArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button variant="primary" size="lg" type="submit" loading={create.isPending}>
              {timing === 'now' ? 'Créer les comptes' : 'Planifier l’arrivée'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
