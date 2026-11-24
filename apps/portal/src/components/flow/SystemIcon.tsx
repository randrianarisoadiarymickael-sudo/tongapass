import { IconBranch, IconChat, IconKey, IconLayers, IconMail } from '@/components/icons';
import type { StepSystem } from '@/lib/types';

const ICONS = {
  keycloak: IconKey,
  gitea: IconBranch,
  chat: IconChat,
  email: IconMail,
  core: IconLayers,
} satisfies Record<StepSystem, unknown>;

export function SystemIcon({ system, className = 'size-4' }: { system: StepSystem; className?: string }) {
  const Icon = ICONS[system] ?? IconLayers;
  return <Icon className={className} />;
}
