import type { ReactNode, SVGProps } from 'react';

/**
 * Pictogrammes TongaPass : dessinés pour le produit sur une grille de 24 px.
 * Trait arrondi de 1,75 px et un léger aplat (16 %) dans la couleur du texte.
 * Aucun pictogramme de banque d'icônes : chaque forme dit quelque chose du métier
 * (registre chaîné, badge, seuil…).
 *
 * Les icônes sont décoratives par défaut (aria-hidden) : le libellé vient du texte voisin.
 */
export interface IconProps extends SVGProps<SVGSVGElement> {
  strokeWidth?: number | string;
}

export type IconComponent = ((props: IconProps) => ReactNode) & { displayName?: string };

/** Aplat : remplissage léger de la couleur courante, sans contour. */
const G = { fill: 'currentColor', fillOpacity: 0.16, stroke: 'none' } as const;
/** Point plein (i, points de suspension) */
const D = { fill: 'currentColor', stroke: 'none' } as const;

function icon(name: string, body: ReactNode): IconComponent {
  const Component = ({ strokeWidth = 1.75, ...props }: IconProps) => (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {body}
    </svg>
  );
  Component.displayName = name;
  return Component;
}

/* ------------------------------------------------------------ Navigation */

export const IconPause = icon('IconPause', <path d="M8 5v14m8-14v14" strokeWidth="3" />);
export const IconPlay = icon('IconPlay', <path d="m7.5 4.5 12 7.5-12 7.5z" />);

/** Vue d'ensemble : tableau de bord en quatre tuiles de tailles différentes. */
export const IconOverview = icon(
  'IconOverview',
  <>
    <rect x="3.5" y="3.5" width="7.5" height="9" rx="2.2" {...G} />
    <rect x="3.5" y="3.5" width="7.5" height="9" rx="2.2" />
    <rect x="13" y="3.5" width="7.5" height="5" rx="2" />
    <rect x="13" y="10.5" width="7.5" height="10" rx="2.2" {...G} />
    <rect x="13" y="10.5" width="7.5" height="10" rx="2.2" />
    <rect x="3.5" y="14.5" width="7.5" height="6" rx="2" />
  </>,
);

/** Annuaire : deux silhouettes décalées. */
export const IconPeople = icon(
  'IconPeople',
  <>
    <circle cx="9" cy="8.5" r="3.3" {...G} />
    <circle cx="9" cy="8.5" r="3.3" />
    <path d="M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M15 5.2a3 3 0 0 1 0 5.6" />
    <path d="M16.5 14.3c2.2.4 3.7 2.2 4 5.2" />
  </>,
);

/** Nouvelle arrivée : silhouette et badge « + ». */
export const IconArrival = icon(
  'IconArrival',
  <>
    <circle cx="9.5" cy="8" r="3.4" {...G} />
    <circle cx="9.5" cy="8" r="3.4" />
    <path d="M3.5 20c.7-3.6 3.1-5.6 6-5.6 1.3 0 2.5.3 3.5 1" />
    <rect x="15" y="14.5" width="6.5" height="6.5" rx="2" {...G} />
    <rect x="15" y="14.5" width="6.5" height="6.5" rx="2" />
    <path d="M18.25 16.4v2.7M16.9 17.75h2.7" />
  </>,
);

/** Exécutions : trois nœuds reliés, comme un workflow n8n. */
export const IconFlow = icon(
  'IconFlow',
  <>
    <rect x="3" y="4" width="6.5" height="5" rx="1.8" {...G} />
    <rect x="3" y="4" width="6.5" height="5" rx="1.8" />
    <rect x="14.5" y="15" width="6.5" height="5" rx="1.8" {...G} />
    <rect x="14.5" y="15" width="6.5" height="5" rx="1.8" />
    <circle cx="18" cy="6.5" r="2.4" />
    <path d="M9.5 6.5h6.1" />
    <path d="M6.25 9v4.5a4 4 0 0 0 4 4h4.25" />
  </>,
);

/** Profils d'accès : badge nominatif avec sa fente de cordon. */
export const IconBadge = icon(
  'IconBadge',
  <>
    <rect x="3.5" y="5.5" width="17" height="14" rx="3" {...G} />
    <rect x="3.5" y="5.5" width="17" height="14" rx="3" />
    <path d="M10 5.5V3.5h4v2" />
    <circle cx="9" cy="11.3" r="2" />
    <path d="M6 16.3c.6-1.3 1.7-2 3-2s2.4.7 3 2" />
    <path d="M14.5 10.5h3M14.5 13.5h2" />
  </>,
);

/** Bouclier coché : conformité, droits vérifiés. */
export const IconShieldCheck = icon(
  'IconShieldCheck',
  <>
    <path d="M12 3.2 5 6v5.4c0 4.3 2.9 7.6 7 9.4 4.1-1.8 7-5.1 7-9.4V6z" {...G} />
    <path d="M12 3.2 5 6v5.4c0 4.3 2.9 7.6 7 9.4 4.1-1.8 7-5.1 7-9.4V6z" />
    <path d="m8.9 12.1 2.2 2.2 4.1-4.4" />
  </>,
);

/** Bouclier d'alerte : écart, accès refusé, révocation. */
export const IconShieldAlert = icon(
  'IconShieldAlert',
  <>
    <path d="M12 3.2 5 6v5.4c0 4.3 2.9 7.6 7 9.4 4.1-1.8 7-5.1 7-9.4V6z" {...G} />
    <path d="M12 3.2 5 6v5.4c0 4.3 2.9 7.6 7 9.4 4.1-1.8 7-5.1 7-9.4V6z" />
    <path d="M12 8.3v4.2" />
    <circle cx="12" cy="15.6" r="1" {...D} />
  </>,
);

/** Journal d'audit : blocs chaînés les uns aux autres (registre infalsifiable). */
export const IconLedger = icon(
  'IconLedger',
  <>
    <rect x="3.5" y="3" width="6.5" height="5" rx="1.6" />
    <rect x="3.5" y="9.5" width="6.5" height="5" rx="1.6" {...G} />
    <rect x="3.5" y="9.5" width="6.5" height="5" rx="1.6" />
    <rect x="3.5" y="16" width="6.5" height="5" rx="1.6" />
    <path d="M6.75 8v1.5M6.75 14.5V16" />
    <path d="M13.5 5.5h7M13.5 12h7M13.5 18.5h4.5" />
  </>,
);

/** Intégrations : un moyeu central relié à trois services. */
export const IconHub = icon(
  'IconHub',
  <>
    <rect x="8.75" y="8.75" width="6.5" height="6.5" rx="2" {...G} />
    <rect x="8.75" y="8.75" width="6.5" height="6.5" rx="2" />
    <circle cx="5" cy="5" r="2" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="12" cy="20.5" r="2" />
    <path d="m6.5 6.5 2.3 2.3M17.5 6.5l-2.3 2.3M12 15.25v3.25" />
  </>,
);

/* ------------------------------------------------------------ Systèmes */

/** Keycloak : clé à anneau rond. */
export const IconKey = icon(
  'IconKey',
  <>
    <circle cx="8" cy="15.5" r="4.2" {...G} />
    <circle cx="8" cy="15.5" r="4.2" />
    <circle cx="8" cy="15.5" r="1.1" {...D} />
    <path d="m11 12.5 8.5-8.5M16.3 7.2l2.4 2.4M13.9 9.6l1.8 1.8" />
  </>,
);

/** Gitea : branches de dépôt. */
export const IconBranch = icon(
  'IconBranch',
  <>
    <circle cx="7" cy="5.5" r="2.2" />
    <circle cx="7" cy="18.5" r="2.2" />
    <circle cx="17" cy="8" r="2.3" {...G} />
    <circle cx="17" cy="8" r="2.3" />
    <path d="M7 7.7v8.6" />
    <path d="M17 10.3c0 3.7-9.6 2.6-9.9 6" />
  </>,
);

/** Mattermost : bulle de discussion. */
export const IconChat = icon(
  'IconChat',
  <>
    <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-8.5l-4 3.3V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z" {...G} />
    <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-8.5l-4 3.3V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z" />
    <path d="M8 9.7h8M8 12.8h5" />
  </>,
);

/** E-mail : enveloppe. */
export const IconMail = icon(
  'IconMail',
  <>
    <rect x="3" y="5.5" width="18" height="13" rx="3" {...G} />
    <rect x="3" y="5.5" width="18" height="13" rx="3" />
    <path d="m4.2 7.6 7.8 5.8 7.8-5.8" />
  </>,
);

/** TongaPass (orchestration) : couches empilées. */
export const IconLayers = icon(
  'IconLayers',
  <>
    <path d="M12 3.8 3.5 8.3 12 12.8l8.5-4.5z" {...G} />
    <path d="M12 3.8 3.5 8.3 12 12.8l8.5-4.5z" />
    <path d="m3.5 12.3 8.5 4.5 8.5-4.5" />
    <path d="m3.5 16.3 8.5 4.5 8.5-4.5" />
  </>,
);

/** n8n (acteur automatique) : puce d'automate. */
export const IconAutomation = icon(
  'IconAutomation',
  <>
    <rect x="6" y="6" width="12" height="12" rx="3" {...G} />
    <rect x="6" y="6" width="12" height="12" rx="3" />
    <circle cx="12" cy="12" r="2.3" />
    <path d="M9.5 3.5V6M14.5 3.5V6M9.5 18v2.5M14.5 18v2.5M3.5 9.5H6M3.5 14.5H6M18 9.5h2.5M18 14.5h2.5" />
  </>,
);

/** Planificateur, durée : horloge. */
export const IconClock = icon(
  'IconClock',
  <>
    <circle cx="12" cy="12.5" r="8" {...G} />
    <circle cx="12" cy="12.5" r="8" />
    <path d="M12 8.3v4.4l2.9 1.8" />
    <path d="M9.5 2.8h5" />
  </>,
);

/** Planification : calendrier et horloge. */
export const IconCalendar = icon(
  'IconCalendar',
  <>
    <path d="M16.5 10V7.5A2.5 2.5 0 0 0 14 5H6a2.5 2.5 0 0 0-2.5 2.5v9A2.5 2.5 0 0 0 6 19h5" />
    <path d="M7.5 3.3v3.2M12.5 3.3v3.2M3.5 9.5h13" />
    <circle cx="17" cy="17" r="4.2" {...G} />
    <circle cx="17" cy="17" r="4.2" />
    <path d="M17 15.2V17l1.3.9" />
  </>,
);

/** Intégrité : maillons de chaîne (empreintes SHA-256 chaînées). */
export const IconChain = icon(
  'IconChain',
  <>
    <path d="M10.2 13.8 13.8 10.2" />
    <path d="M8.6 11.4 6.9 13.1a3.3 3.3 0 0 0 4.7 4.7l1.7-1.7" />
    <path d="m15.4 12.6 1.7-1.7a3.3 3.3 0 0 0-4.7-4.7L10.7 7.9" />
    <circle cx="18.5" cy="18.5" r="2.3" {...G} />
    <circle cx="18.5" cy="18.5" r="2.3" />
  </>,
);

/** Contrôle global : cadre de visée et ligne de lecture. */
export const IconScan = icon(
  'IconScan',
  <>
    <path d="M4 8.5V6.5A2.5 2.5 0 0 1 6.5 4h2M15.5 4h2A2.5 2.5 0 0 1 20 6.5v2M20 15.5v2a2.5 2.5 0 0 1-2.5 2.5h-2M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-2" />
    <rect x="7.5" y="7.5" width="9" height="9" rx="2" {...G} />
    <path d="M6.5 12h11" />
  </>,
);

/** Signal en direct : tracé de pouls. */
export const IconPulse = icon(
  'IconPulse',
  <>
    <path d="M3 12.5h3.8l2.1-5.3 4.3 10 2.3-4.7H21" />
  </>,
);

/** Cadenas : sécurité, secret. */
export const IconLock = icon(
  'IconLock',
  <>
    <rect x="5" y="10.5" width="14" height="10" rx="2.8" {...G} />
    <rect x="5" y="10.5" width="14" height="10" rx="2.8" />
    <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
    <path d="M12 14.4v2.2" />
  </>,
);

/** Code versionné (workflows « as code »). */
export const IconCode = icon(
  'IconCode',
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="3" {...G} />
    <rect x="3" y="4.5" width="18" height="15" rx="3" />
    <path d="m9 10-2.2 2 2.2 2M15 10l2.2 2-2.2 2M12.8 9l-1.6 6" />
  </>,
);

/** Conteneurs : blocs empilés. */
export const IconContainers = icon(
  'IconContainers',
  <>
    <rect x="3.5" y="12.5" width="7.5" height="7" rx="1.6" {...G} />
    <rect x="3.5" y="12.5" width="7.5" height="7" rx="1.6" />
    <rect x="13" y="12.5" width="7.5" height="7" rx="1.6" />
    <rect x="8.25" y="4" width="7.5" height="7" rx="1.6" />
  </>,
);

/* ------------------------------------------------------------ Actions */

export const IconSearch = icon(
  'IconSearch',
  <>
    <circle cx="10.5" cy="10.5" r="6.2" {...G} />
    <circle cx="10.5" cy="10.5" r="6.2" />
    <path d="m15.3 15.3 5.2 5.2" />
  </>,
);

export const IconMenu = icon('IconMenu', <path d="M4 7h16M4 12h10M4 17h13" />);

export const IconSidebar = icon(
  'IconSidebar',
  <>
    <path d="M6.5 4.5h3v15h-3a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z" {...G} />
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <path d="M9.5 4.5v15" />
  </>,
);

export const IconSun = icon(
  'IconSun',
  <>
    <circle cx="12" cy="12" r="4" {...G} />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.8v1.7M12 19.5v1.7M2.8 12h1.7M19.5 12h1.7M5.5 5.5l1.2 1.2M17.3 17.3l1.2 1.2M5.5 18.5l1.2-1.2M17.3 6.7l1.2-1.2" />
  </>,
);

export const IconMoon = icon(
  'IconMoon',
  <>
    <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z" {...G} />
    <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z" />
    <path d="M16.5 3.5v2.4M15.3 4.7h2.4" />
  </>,
);

/** Entrer (connexion, arrivée) : flèche qui franchit un seuil. */
export const IconEnter = icon(
  'IconEnter',
  <>
    <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14" />
    <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14z" {...G} />
    <path d="M3.5 12H14M10.5 8.5 14 12l-3.5 3.5" />
  </>,
);

/** Sortir (déconnexion, départ) : flèche qui quitte le seuil. */
export const IconExit = icon(
  'IconExit',
  <>
    <path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10z" {...G} />
    <path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" />
    <path d="M10.5 12h9.5M16.5 8.5 20 12l-3.5 3.5" />
  </>,
);

/** Mobilité : deux flux qui se croisent. */
export const IconSwap = icon('IconSwap', <path d="M4.5 8h14M15 4.5 18.5 8 15 11.5M19.5 16h-14M9 12.5 5.5 16 9 19.5" />);

export const IconExternal = icon(
  'IconExternal',
  <>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14v3.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 4 17.5v-9A2.5 2.5 0 0 1 6.5 6H10" />
  </>,
);

export const IconChevronRight = icon('IconChevronRight', <path d="m9.5 6 6 6-6 6" />);
export const IconChevronLeft = icon('IconChevronLeft', <path d="m14.5 6-6 6 6 6" />);
export const IconChevronDown = icon('IconChevronDown', <path d="m6 9.5 6 6 6-6" />);

export const IconArrowRight = icon('IconArrowRight', <path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5" />);
export const IconArrowLeft = icon('IconArrowLeft', <path d="M19.5 12h-15M10 6.5 4.5 12l5.5 5.5" />);
export const IconArrowUp = icon('IconArrowUp', <path d="M12 19.5v-15M6.5 10 12 4.5 17.5 10" />);
export const IconArrowDown = icon('IconArrowDown', <path d="M12 4.5v15M6.5 14l5.5 5.5 5.5-5.5" />);
export const IconSort = icon('IconSort', <path d="M8 19.5v-15M4.5 8 8 4.5 11.5 8M16 4.5v15M12.5 16l3.5 3.5 3.5-3.5" />);

export const IconClose = icon('IconClose', <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />);
export const IconCheck = icon('IconCheck', <path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconMinus = icon('IconMinus', <path d="M6 12h12" />);
export const IconPlus = icon('IconPlus', <path d="M12 5.5v13M5.5 12h13" />);

export const IconRetry = icon(
  'IconRetry',
  <>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.3v4.2h-4.2" />
  </>,
);

export const IconHistory = icon(
  'IconHistory',
  <>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 4.3v4.2h4.2" />
    <path d="M12 8.5V12l2.6 1.6" />
  </>,
);

export const IconAlert = icon(
  'IconAlert',
  <>
    <path d="M10.3 4.4 3.3 17a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12.6a2 2 0 0 0-3.4 0z" {...G} />
    <path d="M10.3 4.4 3.3 17a2 2 0 0 0 1.7 3h14a2 2 0 0 0 1.7-3l-7-12.6a2 2 0 0 0-3.4 0z" />
    <path d="M12 9.3v4" />
    <circle cx="12" cy="16.6" r="1" {...D} />
  </>,
);

export const IconDownload = icon(
  'IconDownload',
  <>
    <path d="M12 4v10.5M7.5 10 12 14.5 16.5 10" />
    <path d="M4.5 15.5v2A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-2" />
  </>,
);

export const IconMore = icon(
  'IconMore',
  <>
    <circle cx="6" cy="12" r="1.5" {...D} />
    <circle cx="12" cy="12" r="1.5" {...D} />
    <circle cx="18" cy="12" r="1.5" {...D} />
  </>,
);

export const IconEdit = icon(
  'IconEdit',
  <>
    <path d="M15.5 4.5 19.5 8.5 9 19l-4.8.8.8-4.8z" {...G} />
    <path d="M15.5 4.5 19.5 8.5 9 19l-4.8.8.8-4.8z" />
    <path d="m13.3 6.7 4 4" />
  </>,
);

export const IconTrash = icon(
  'IconTrash',
  <>
    <path d="m6.5 7 .8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7z" {...G} />
    <path d="m6.5 7 .8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7" />
    <path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M10.5 11v5M13.5 11v5" />
  </>,
);

export const IconPerson = icon(
  'IconPerson',
  <>
    <circle cx="12" cy="8.5" r="3.8" {...G} />
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M5 20c.9-3.8 3.7-6 7-6s6.1 2.2 7 6" />
  </>,
);

export const IconOffline = icon(
  'IconOffline',
  <>
    <path d="M5 9.4a10 10 0 0 1 4-2.1M14.6 7.2A10 10 0 0 1 19 9.4M7.8 12.6a6 6 0 0 1 2.4-1.3M15.8 12.3l.4.3" />
    <circle cx="12" cy="16.8" r="1.1" {...D} />
    <path d="m4 4 16 16" />
  </>,
);

export const IconBars = icon(
  'IconBars',
  <>
    <rect x="4" y="11" width="4" height="9" rx="1.3" {...G} />
    <rect x="4" y="11" width="4" height="9" rx="1.3" />
    <rect x="10" y="5" width="4" height="15" rx="1.3" />
    <rect x="16" y="8.5" width="4" height="11.5" rx="1.3" {...G} />
    <rect x="16" y="8.5" width="4" height="11.5" rx="1.3" />
  </>,
);

export const IconTable = icon(
  'IconTable',
  <>
    <path d="M6 4.5h12a2.5 2.5 0 0 1 2.5 2.5v2h-17V7A2.5 2.5 0 0 1 6 4.5z" {...G} />
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9h17M3.5 14.2h17M10 9v10.5" />
  </>,
);
