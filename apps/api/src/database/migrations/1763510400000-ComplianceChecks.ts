import { MigrationInterface, QueryRunner } from 'typeorm';

/** Historique des contrôles de conformité (droits réels Keycloak ↔ droits attendus). */
export class ComplianceChecks1763510400000 implements MigrationInterface {
  name = 'ComplianceChecks1763510400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "compliance_checks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL,
        "status" varchar(16) NOT NULL,
        "details" jsonb NOT NULL,
        "triggered_by" varchar(120) NOT NULL,
        "checked_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_compliance_checks" PRIMARY KEY ("id"),
        CONSTRAINT "fk_compliance_checks_employee" FOREIGN KEY ("employee_id")
          REFERENCES "employees"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "ix_compliance_checks_employee" ON "compliance_checks" ("employee_id", "checked_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "ix_compliance_checks_status" ON "compliance_checks" ("status")`);
    await queryRunner.query(`CREATE INDEX "ix_workflow_runs_due" ON "workflow_runs" ("status", "scheduled_for")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ix_workflow_runs_due"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "compliance_checks"`);
  }
}
