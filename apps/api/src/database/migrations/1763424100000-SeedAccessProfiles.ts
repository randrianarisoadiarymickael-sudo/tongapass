import { MigrationInterface, QueryRunner } from 'typeorm';

interface SeedProfile {
  code: string;
  name: string;
  description: string;
  color: string;
  realmRoles: string[];
  groups: string[];
  giteaTeams: string[];
  chatChannels: string[];
}

/** Profils d'accès de départ, alignés sur le catalogue Keycloak / Gitea / Mattermost. */
export const SEED_PROFILES: SeedProfile[] = [
  {
    code: 'dev-backend',
    name: 'Développement back-end',
    description: 'Accès au code source, aux revues et au canal technique. Aucun accès production.',
    color: '#2563C9',
    realmRoles: ['employee', 'developer'],
    groups: ['Engineering'],
    giteaTeams: ['developers'],
    chatChannels: ['town-square', 'bienvenue', 'engineering'],
  },
  {
    code: 'devops',
    name: 'Ingénierie DevOps',
    description: 'Code, pipelines et astreinte incidents. Droits étendus justifiés par le poste.',
    color: '#0F7B6C',
    realmRoles: ['employee', 'developer', 'devops'],
    groups: ['Engineering'],
    giteaTeams: ['developers', 'devops'],
    chatChannels: ['town-square', 'bienvenue', 'engineering', 'incidents'],
  },
  {
    code: 'people-ops',
    name: 'Ressources humaines',
    description: 'Outils RH et canal People. Pas d’accès au code source.',
    color: '#B4530A',
    realmRoles: ['employee', 'people-ops'],
    groups: ['People'],
    giteaTeams: [],
    chatChannels: ['town-square', 'bienvenue', 'people'],
  },
  {
    code: 'finance',
    name: 'Comptabilité et finance',
    description: 'Outils financiers et canal Finance. Pas d’accès au code source.',
    color: '#7C3AED',
    realmRoles: ['employee', 'finance'],
    groups: ['Finance'],
    giteaTeams: [],
    chatChannels: ['town-square', 'bienvenue', 'finance'],
  },
  {
    code: 'support',
    name: 'Support client',
    description: 'Lecture seule sur la documentation technique, canal Support.',
    color: '#C8372D',
    realmRoles: ['employee', 'support'],
    groups: ['Support'],
    giteaTeams: ['readers'],
    chatChannels: ['town-square', 'bienvenue', 'support'],
  },
  {
    code: 'intern',
    name: 'Stage',
    description: 'Accès minimal en lecture seule, limité à la durée du stage.',
    color: '#64748B',
    realmRoles: ['employee', 'intern'],
    groups: [],
    giteaTeams: ['readers'],
    chatChannels: ['town-square', 'bienvenue'],
  },
];

export class SeedAccessProfiles1763424100000 implements MigrationInterface {
  name = 'SeedAccessProfiles1763424100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const profile of SEED_PROFILES) {
      await queryRunner.query(
        `INSERT INTO "access_profiles"
          ("code","name","description","color","realm_roles","groups","gitea_teams","chat_channels")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT ("code") DO NOTHING`,
        [
          profile.code,
          profile.name,
          profile.description,
          profile.color,
          profile.realmRoles,
          profile.groups,
          profile.giteaTeams,
          profile.chatChannels,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "access_profiles" WHERE "code" = ANY($1)`, [
      SEED_PROFILES.map((profile) => profile.code),
    ]);
  }
}
