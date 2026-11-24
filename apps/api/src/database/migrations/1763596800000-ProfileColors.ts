import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nouvelle palette des profils d'accès (charte « Registre des accès »).
 * Seules les couleurs d'origine sont remplacées : une couleur choisie depuis le portail est conservée.
 * Palette validée : écart perceptuel et daltonisme (deutéranopie, protanopie, tritanopie) sur fond clair.
 */
const CHANGES: { code: string; from: string; to: string }[] = [
  { code: 'dev-backend', from: '#2563C9', to: '#3B57C2' },
  { code: 'devops', from: '#0F7B6C', to: '#00876D' },
  { code: 'people-ops', from: '#B4530A', to: '#A25A12' },
  { code: 'finance', from: '#7C3AED', to: '#7A4AA8' },
  { code: 'support', from: '#C8372D', to: '#1C7FB0' },
  { code: 'intern', from: '#64748B', to: '#64708A' },
];

export class ProfileColors1763596800000 implements MigrationInterface {
  name = 'ProfileColors1763596800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const change of CHANGES) {
      await queryRunner.query(`UPDATE "access_profiles" SET "color" = $1 WHERE "code" = $2 AND upper("color") = $3`, [
        change.to,
        change.code,
        change.from,
      ]);
    }
    await queryRunner.query(`ALTER TABLE "access_profiles" ALTER COLUMN "color" SET DEFAULT '#3B57C2'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "access_profiles" ALTER COLUMN "color" SET DEFAULT '#2563C9'`);
    for (const change of CHANGES) {
      await queryRunner.query(`UPDATE "access_profiles" SET "color" = $1 WHERE "code" = $2 AND upper("color") = $3`, [
        change.from,
        change.code,
        change.to.toUpperCase(),
      ]);
    }
  }
}
