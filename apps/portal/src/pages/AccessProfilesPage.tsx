import { IconEdit, IconPlus, IconShieldCheck, IconTrash } from '@/components/icons';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useMe } from '@/auth/AuthProvider';
import { AccessMatrix } from '@/components/employee/AccessMatrix';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/Feedback';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Field';
import { useCatalog, useDeleteProfile, useProfiles, useSaveProfile } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { AccessCatalog, AccessProfile } from '@/lib/types';

const KINDS: { key: keyof AccessCatalog; title: string; prefix?: string }[] = [
  { key: 'realmRoles', title: 'Rôles Keycloak' },
  { key: 'groups', title: 'Groupes Keycloak', prefix: '/' },
  { key: 'giteaTeams', title: 'Équipes Gitea' },
  { key: 'chatChannels', title: 'Canaux Mattermost', prefix: '~' },
];

/** Palette des profils, validée pour le daltonisme ; l'ardoise reste réservée aux profils neutres. */
const COLORS = [
  { value: '#3B57C2', name: 'Indigo' },
  { value: '#A25A12', name: 'Ocre' },
  { value: '#00876D', name: 'Ravinala' },
  { value: '#7A4AA8', name: 'Améthyste' },
  { value: '#B3412B', name: 'Latérite' },
  { value: '#1C7FB0', name: 'Lagon' },
  { value: '#A63A72', name: 'Litchi' },
  { value: '#64708A', name: 'Ardoise' },
];

type Draft = Pick<AccessProfile, 'code' | 'name' | 'description' | 'color' | 'realmRoles' | 'groups' | 'giteaTeams' | 'chatChannels' | 'isActive'>;

function ProfileDialog({
  profile,
  catalog,
  open,
  onOpenChange,
}: {
  profile: AccessProfile | null;
  catalog: AccessCatalog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveProfile();
  const [draft, setDraft] = useState<Draft>(
    profile ?? {
      code: '',
      name: '',
      description: '',
      color: COLORS[0].value,
      realmRoles: ['employee'],
      groups: [],
      giteaTeams: [],
      chatChannels: ['town-square', 'bienvenue'],
      isActive: true,
    },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggle = (kind: keyof AccessCatalog, value: string) =>
    setDraft((d) => ({ ...d, [kind]: d[kind].includes(value) ? d[kind].filter((v) => v !== value) : [...d[kind], value] }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = profile
      ? {
          name: draft.name,
          description: draft.description,
          color: draft.color,
          realmRoles: draft.realmRoles,
          groups: draft.groups,
          giteaTeams: draft.giteaTeams,
          chatChannels: draft.chatChannels,
          isActive: draft.isActive,
        }
      : { ...draft, isActive: undefined };
    try {
      await save.mutateAsync({ id: profile?.id, body });
      toast.success(profile ? 'Profil mis à jour' : 'Profil créé', { description: 'Le changement est tracé dans le journal d’audit.' });
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors());
      toast.error('Enregistrement refusé', { description: errorMessage(error) });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={profile ? `Modifier « ${profile.name} »` : 'Nouveau profil d’accès'}
      description="Composez le minimum nécessaire au poste à partir du catalogue fermé : aucun rôle d’administration n’y figure."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="profile-form" loading={save.isPending}>
            {profile ? 'Enregistrer' : 'Créer le profil'}
          </Button>
        </>
      }
    >
      <form id="profile-form" onSubmit={submit} className="space-y-5 pb-1" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" error={errors.name}>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Analyse de données…" />
          </Field>
          <Field label="Code" error={errors.code} hint={profile ? 'Le code ne peut pas changer' : 'Minuscules et tirets, ex. data-analyst'}>
            <Input
              value={draft.code}
              disabled={!!profile}
              onChange={(e) => setDraft({ ...draft, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              className="font-mono"
              spellCheck={false}
              translate="no"
            />
          </Field>
          <Field label="Description" optional error={errors.description} className="sm:col-span-2">
            <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-16" />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">Couleur d’identification</legend>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((color) => (
              <label key={color.value} className="cursor-pointer" title={color.name}>
                <input
                  type="radio"
                  name="color"
                  value={color.value}
                  checked={draft.color.toUpperCase() === color.value}
                  onChange={() => setDraft({ ...draft, color: color.value })}
                  className="peer sr-only"
                />
                <span className="sr-only">{color.name}</span>
                <span
                  aria-hidden="true"
                  className="flex size-7 items-center justify-center rounded-md border border-line transition-shadow peer-checked:shadow-[0_0_0_2px_var(--tp-surface),0_0_0_3.5px_var(--tp-ink)] peer-focus-visible:shadow-[0_0_0_2px_var(--tp-surface),0_0_0_3.5px_var(--tp-info)]"
                >
                  <span className="size-4 rounded-[4px]" style={{ background: color.value }} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {KINDS.map((kind) => (
          <fieldset key={kind.key} className="rounded-xl border border-line bg-hover/40">
            <legend className="ml-3 px-1 text-[13px] font-medium">{kind.title}</legend>
            <div className="grid gap-x-4 px-3.5 pb-2 sm:grid-cols-2">
              {catalog[kind.key].map((item) => {
                const locked = kind.key === 'realmRoles' && item.value === 'employee';
                return (
                  <Checkbox
                    key={item.value}
                    checked={draft[kind.key].includes(item.value)}
                    onChange={() => (locked ? undefined : toggle(kind.key, item.value))}
                    className={cn(locked && 'pointer-events-none opacity-70')}
                    label={
                      <span translate="no">
                        {kind.prefix}
                        {item.value}
                        {item.sensitive ? <span className="ml-1.5 text-xs text-warning">sensible</span> : null}
                        {locked ? <span className="ml-1.5 text-xs text-ink-3">obligatoire</span> : null}
                      </span>
                    }
                    description={item.description}
                  />
                );
              })}
            </div>
            {errors[kind.key] ? <p className="px-3.5 pb-2 text-xs font-medium text-danger">{errors[kind.key]}</p> : null}
          </fieldset>
        ))}
        {profile ? (
          <Checkbox
            checked={draft.isActive}
            onChange={(checked) => setDraft({ ...draft, isActive: checked })}
            label="Profil actif"
            description="Un profil inactif n’est plus proposé pour les arrivées et les mobilités."
          />
        ) : null}
      </form>
    </Dialog>
  );
}

export function AccessProfilesPage() {
  useDocumentTitle('Profils d’accès');
  const me = useMe();
  const { data, isPending, error, refetch } = useProfiles(true);
  const catalog = useCatalog();
  const remove = useDeleteProfile();
  const [editing, setEditing] = useState<AccessProfile | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<AccessProfile | null>(null);
  const sensitive = useMemo(
    () =>
      new Set(
        Object.values(catalog.data ?? {})
          .flat()
          .filter((item) => item.sensitive)
          .map((item) => item.value),
      ),
    [catalog.data],
  );

  return (
    <div>
      <PageHeader
        title="Profils d’accès"
        description="Un profil décrit les droits minimaux d’un poste. Les comptes sont créés et contrôlés exactement selon ce modèle."
        actions={
          me.permissions.manageProfiles ? (
            <Button variant="primary" onClick={() => setEditing(null)} icon={<IconPlus className="size-4" aria-hidden="true" />} disabled={!catalog.data}>
              Nouveau profil
            </Button>
          ) : null
        }
      />
      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <EmptyState icon={<IconShieldCheck className="size-5" aria-hidden="true" />} title="Aucun profil">
          Créez un premier profil pour pouvoir déclarer des arrivées.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {data?.map((profile) => (
            <li key={profile.id}>
              <div className={cn('flex h-full flex-col panel rounded-[var(--radius-panel)]', !profile.isActive && 'opacity-70')}>
                <div className="flex items-start gap-3 border-b border-line px-4 py-3">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-[3px]" style={{ background: profile.color }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {profile.name}
                      {!profile.isActive ? <Badge tone="warning">Inactif</Badge> : null}
                    </h2>
                    <p className="text-[13px] leading-snug text-ink-3">{profile.description || 'Sans description'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="mr-1 text-xs tabular text-ink-3">
                      {profile.employeeCount ?? 0} employé{(profile.employeeCount ?? 0) > 1 ? 's' : ''}
                    </span>
                    {me.permissions.manageProfiles ? (
                      <>
                        <IconButton label={`Modifier ${profile.name}`} onClick={() => setEditing(profile)}>
                          <IconEdit className="size-4" aria-hidden="true" />
                        </IconButton>
                        {!profile.employeeCount ? (
                          <IconButton label={`Supprimer ${profile.name}`} className="hover:bg-danger-soft hover:text-danger" onClick={() => setConfirmDelete(profile)}>
                            <IconTrash className="size-4" aria-hidden="true" />
                          </IconButton>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex-1 px-4 py-1">
                  <AccessMatrix access={profile} sensitive={sensitive} />
                </div>
                <p className="border-t border-line px-4 py-2 font-mono text-xs text-ink-3" translate="no">
                  {profile.code}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing !== undefined && catalog.data ? (
        <ProfileDialog key={editing?.id ?? 'new'} profile={editing} catalog={catalog.data} open onOpenChange={(open) => !open && setEditing(undefined)} />
      ) : null}
      {confirmDelete ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setConfirmDelete(null)}
          title={`Supprimer « ${confirmDelete.name} » ?`}
          description="Aucun employé n’utilise ce profil. La suppression est définitive et tracée dans le journal d’audit."
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                loading={remove.isPending}
                onClick={async () => {
                  try {
                    await remove.mutateAsync(confirmDelete.id);
                    toast.success('Profil supprimé');
                    setConfirmDelete(null);
                  } catch (e) {
                    toast.error('Suppression impossible', { description: errorMessage(e) });
                  }
                }}
              >
                Supprimer
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">Pensez à désactiver plutôt qu’à supprimer si le profil peut resservir.</p>
        </Dialog>
      ) : null}
    </div>
  );
}
