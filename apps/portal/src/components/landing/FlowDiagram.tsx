import { useId } from 'react';
import { useVisiblePlayback } from '@/hooks/useVisiblePlayback';
import { FLOW_STEPS } from './flow-steps';
import { IconAutomation, IconBranch, IconChat, IconKey, IconLayers, IconLedger, IconMail, IconPeople, type IconComponent } from '@/components/icons';

interface Node {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  icon: IconComponent;
  accent?: boolean;
}

const NODES: Record<string, Node> = {
  rh: { x: 8, y: 150, w: 160, h: 78, title: 'Équipe RH', sub: 'Portail React', icon: IconPeople },
  api: { x: 262, y: 150, w: 186, h: 78, title: 'API TongaPass', sub: 'NestJS · OpenAPI', icon: IconLayers, accent: true },
  db: { x: 262, y: 292, w: 186, h: 66, title: 'PostgreSQL', sub: 'audit chaîné SHA-256', icon: IconLedger },
  n8n: { x: 548, y: 150, w: 160, h: 78, title: 'n8n', sub: '4 workflows', icon: IconAutomation, accent: true },
  kc: { x: 786, y: 14, w: 206, h: 62, title: 'Keycloak', sub: 'compte, rôles, sessions', icon: IconKey },
  gitea: { x: 786, y: 104, w: 206, h: 62, title: 'Gitea', sub: 'compte et équipes', icon: IconBranch },
  chat: { x: 786, y: 194, w: 206, h: 62, title: 'Mattermost', sub: 'canaux, ~bienvenue', icon: IconChat },
  smtp: { x: 786, y: 284, w: 206, h: 62, title: 'SMTP', sub: 'bienvenue, récapitulatifs', icon: IconMail },
};

/** Liaisons du schéma, dans le sens du flux ; « back » = rappel de n8n vers l'API. */
const EDGES = [
  { id: 'rh-api', d: 'M168 189 H262', label: 'OIDC + PKCE', lx: 215, ly: 178 },
  { id: 'api-n8n', d: 'M448 178 H548', label: 'webhook + jeton', lx: 498, ly: 168 },
  { id: 'n8n-api', d: 'M548 202 H448', label: 'rappels HMAC', lx: 498, ly: 220, back: true },
  { id: 'api-db', d: 'M355 228 V292' },
  { id: 'n8n-kc', d: 'M708 189 C748 189 748 45 786 45' },
  { id: 'n8n-gitea', d: 'M708 189 C748 189 748 135 786 135' },
  { id: 'n8n-chat', d: 'M708 189 C748 189 748 225 786 225' },
  { id: 'n8n-smtp', d: 'M708 189 C748 189 748 315 786 315' },
] as const;

/**
 * Le portail appelle l'API, qui déclenche n8n ; n8n agit sur
 * chaque outil et renvoie des rappels signés (en pointillés) vers l'API.
 */
export function FlowDiagram({ enabled }: { enabled: boolean }) {
  const uid = useId().replace(/:/g, '');
  const { ref, playing } = useVisiblePlayback<HTMLDivElement>(enabled);
  return (
    <div ref={ref} className="architecture-flow" data-playing={playing}>
      <div className="architecture-map panel mt-6 hidden rounded-2xl p-6 lg:block">
        <svg viewBox="0 0 1000 372" className="h-auto w-full" role="img" aria-labelledby={`${uid}-title`}>
          <title id={`${uid}-title`}>
            Architecture : le portail RH appelle l’API TongaPass, qui déclenche n8n ; n8n crée ou révoque les accès dans Keycloak, Gitea,
            Mattermost et par e-mail, puis renvoie à l’API des rappels signés. L’API journalise tout dans PostgreSQL.
          </title>

          {EDGES.map((edge) => (
            <g key={edge.id}>
              <path d={edge.d} fill="none" stroke={'back' in edge ? 'var(--tp-accent)' : 'var(--tp-ink-3)'} strokeWidth="1.4" strokeDasharray={'back' in edge ? '5 4' : undefined} />
              <path className="flow-packet" data-edge={edge.id} d={edge.d} fill="none" pathLength="1" stroke="var(--tp-brand)" strokeLinecap="round" strokeWidth="3" strokeDasharray=".09 1.1" aria-hidden="true" />
              {'label' in edge ? (
                <text x={edge.lx} y={edge.ly} textAnchor="middle" className="fill-ink-3 text-[11px]">
                  {edge.label}
                </text>
              ) : null}
            </g>
          ))}

          {Object.entries(NODES).map(([key, node]) => (
            <g key={key}>
              <rect
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx="8"
                fill={node.accent ? 'var(--tp-sunken)' : 'var(--tp-surface)'}
                stroke={node.accent ? 'var(--tp-brand)' : 'var(--tp-line-strong)'}
                strokeWidth="1.2"
              />
              <node.icon x={node.x + 16} y={node.y + node.h / 2 - 10} width="20" height="20" className="text-ink-3" />
              <text x={node.x + 48} y={node.y + node.h / 2 - 3} className="fill-ink text-[15px] font-semibold">
                {node.title}
              </text>
              <text x={node.x + 48} y={node.y + node.h / 2 + 15} className="fill-ink-3 text-[11.5px]">
                {node.sub}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <ol className="flow-list mt-5 space-y-3 text-ink-2 lg:hidden">
        {FLOW_STEPS.map((step) => <li key={step.title}><strong className="text-ink">{step.title}.</strong> {step.text}</li>)}
      </ol>
    </div>
  );
}
