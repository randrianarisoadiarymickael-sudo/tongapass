/**
 * Catalogue fermé des droits attribuables par un profil d'accès.
 *
 * Sécurité : seuls ces éléments peuvent être provisionnés automatiquement. Les rôles
 * d'administration (tp-admin, realm-admin, rôles realm-management…) n'y figurent pas :
 * un profil ne peut donc jamais servir à une escalade de privilèges.
 */
export interface CatalogItem {
  value: string;
  label: string;
  description: string;
  sensitive?: boolean;
}

export const BASELINE_ROLE = 'employee';

export const ACCESS_CATALOG = {
  realmRoles: [
    { value: 'employee', label: 'Salarié', description: 'Socle commun, obligatoire pour tout compte' },
    { value: 'developer', label: 'Développement', description: 'Applications internes de développement' },
    { value: 'devops', label: 'DevOps', description: 'Pipelines CI/CD et outillage d’exploitation', sensitive: true },
    { value: 'people-ops', label: 'People Ops', description: 'Outils RH (paie, congés)', sensitive: true },
    { value: 'finance', label: 'Finance', description: 'Comptabilité et facturation', sensitive: true },
    { value: 'support', label: 'Support', description: 'Outil de ticketing client' },
    { value: 'intern', label: 'Stagiaire', description: 'Accès restreint et limité dans le temps' },
  ],
  groups: [
    { value: 'Engineering', label: 'Engineering', description: 'Équipes produit et technique' },
    { value: 'People', label: 'People', description: 'Ressources humaines' },
    { value: 'Finance', label: 'Finance', description: 'Direction financière' },
    { value: 'Support', label: 'Support', description: 'Relation client' },
  ],
  giteaTeams: [
    { value: 'developers', label: 'developers', description: 'Lecture et écriture sur les dépôts applicatifs' },
    { value: 'devops', label: 'devops', description: 'Administration des dépôts d’infrastructure', sensitive: true },
    { value: 'readers', label: 'readers', description: 'Lecture seule' },
  ],
  chatChannels: [
    { value: 'town-square', label: 'town-square', description: 'Canal général de l’entreprise' },
    { value: 'bienvenue', label: 'bienvenue', description: 'Annonces des arrivées' },
    { value: 'engineering', label: 'engineering', description: 'Échanges techniques' },
    { value: 'incidents', label: 'incidents', description: 'Astreinte et gestion d’incidents', sensitive: true },
    { value: 'people', label: 'people', description: 'Équipe RH' },
    { value: 'finance', label: 'finance', description: 'Équipe finance' },
    { value: 'support', label: 'support', description: 'Équipe support' },
  ],
} satisfies Record<string, CatalogItem[]>;

export type CatalogKind = keyof typeof ACCESS_CATALOG;

export const catalogValues = (kind: CatalogKind): string[] => ACCESS_CATALOG[kind].map((item) => item.value);
