import {
  IconArrival,
  IconBadge,
  IconFlow,
  IconHub,
  IconLedger,
  IconOverview,
  IconPeople,
  IconShieldCheck,
  type IconComponent,
} from '@/components/icons';
import type { Me } from '@/lib/types';

export interface NavItem {
  to: string;
  label: string;
  icon: IconComponent;
  section: 'gestion' | 'controle';
  visible: (me: Me) => boolean;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Vue d’ensemble', icon: IconOverview, section: 'gestion', visible: () => true, end: true },
  { to: '/employes', label: 'Annuaire', icon: IconPeople, section: 'gestion', visible: () => true },
  { to: '/arrivees/nouvelle', label: 'Nouvelle arrivée', icon: IconArrival, section: 'gestion', visible: (me) => me.permissions.manageEmployees },
  { to: '/executions', label: 'Exécutions', icon: IconFlow, section: 'gestion', visible: () => true },
  { to: '/profils', label: 'Profils d’accès', icon: IconBadge, section: 'gestion', visible: () => true },
  { to: '/conformite', label: 'Conformité', icon: IconShieldCheck, section: 'controle', visible: (me) => me.permissions.viewAudit },
  { to: '/audit', label: 'Journal d’audit', icon: IconLedger, section: 'controle', visible: (me) => me.permissions.viewAudit },
  { to: '/integrations', label: 'Intégrations', icon: IconHub, section: 'controle', visible: (me) => me.permissions.viewIntegrations },
];

export const SECTION_LABEL: Record<NavItem['section'], string> = {
  gestion: 'Gestion',
  controle: 'Contrôle',
};
