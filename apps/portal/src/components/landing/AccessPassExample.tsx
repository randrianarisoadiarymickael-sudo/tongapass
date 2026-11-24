import { Tabs } from 'radix-ui';
import { useEffect, useState } from 'react';
import { IconBranch, IconChat, IconCheck, IconKey } from '@/components/icons';
import { useVisiblePlayback } from '@/hooks/useVisiblePlayback';

const SYSTEMS = [
  { name: 'Keycloak', icon: IconKey },
  { name: 'Gitea', icon: IconBranch },
  { name: 'Mattermost', icon: IconChat },
] as const;

const SCENARIOS = [
  { phase: 'Arrivée', profile: 'Développement back-end', state: 'Accès ouverts', systems: ['Compte activé', 'Équipe developers', 'Canal ~engineering'] },
  { phase: 'Mobilité', profile: 'Ingénierie DevOps', state: 'Profil modifié', systems: ['Rôles ajustés', 'Équipe devops', 'Canal ~incidents'] },
  { phase: 'Départ', profile: 'Ingénierie DevOps', state: 'Accès révoqués', systems: ['Sessions révoquées', 'Compte bloqué', 'Compte désactivé'] },
] as const;

interface PlaybackProps {
  enabled: boolean;
  reduced: boolean;
}

function Sequence({ scenario, enabled, reduced }: PlaybackProps & { scenario: (typeof SCENARIOS)[number] }) {
  const { ref, playing } = useVisiblePlayback<HTMLDivElement>(enabled);
  const [completed, setCompleted] = useState(0);
  const done = reduced ? SYSTEMS.length : completed;

  useEffect(() => {
    if (!playing) return;
    const finished = completed === SYSTEMS.length;
    const timer = window.setTimeout(() => setCompleted(finished ? 0 : completed + 1), finished ? 2400 : 850);
    return () => window.clearTimeout(timer);
  }, [playing, completed]);

  return (
    <div className="demo-grid" ref={ref} data-playing={playing}>
      <div className="demo-person">
        <span className="demo-avatar" aria-hidden="true">HR</span>
        <div><strong>Hanitra Rakoto</strong><p>{scenario.profile}</p></div>
      </div>
      <div className="demo-track">
        <ol className="demo-systems" aria-label="Progression de l’exemple">
          {SYSTEMS.map(({ name, icon: Icon }, i) => (
            <li key={name} data-stage={i < done ? 'done' : i === done ? 'running' : 'pending'}>
              <span className="system-icon"><Icon aria-hidden="true" /></span>
              <span className="system-copy"><strong>{name}</strong><small>{i < done ? scenario.systems[i] : i === done ? 'En cours…' : 'En attente'}</small></span>
            </li>
          ))}
        </ol>
        <div className="demo-progress">
          <span className="demo-status">{done === SYSTEMS.length ? <><IconCheck />{scenario.state}</> : 'Mise à jour des accès'}</span>
          <span className="demo-meter" aria-hidden="true"><i style={{ transform: `scaleX(${done / SYSTEMS.length})` }} /></span>
          <span className="font-mono tabular">{done}/{SYSTEMS.length}</span>
        </div>
      </div>
    </div>
  );
}

export function AccessPassExample({ enabled, reduced }: PlaybackProps) {
  return (
    <figure className="flow-demo" id="cycle" aria-label="Exemple de fiche d’accès">
      <Tabs.Root defaultValue="Arrivée">
        <div className="demo-header">
          <div><p className="demo-label">Démonstration</p><h2>Un parcours d’accès</h2></div>
          <Tabs.List className="demo-tabs" aria-label="Mouvement à prévisualiser">
            {SCENARIOS.map(({ phase }) => <Tabs.Trigger key={phase} value={phase}>{phase}</Tabs.Trigger>)}
          </Tabs.List>
        </div>
        {SCENARIOS.map((scenario) => (
          <Tabs.Content key={scenario.phase} value={scenario.phase}><Sequence scenario={scenario} enabled={enabled} reduced={reduced} /></Tabs.Content>
        ))}
      </Tabs.Root>
    </figure>
  );
}
