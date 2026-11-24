import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1763424000000 implements MigrationInterface {
  name = 'InitialSchema1763424000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "access_profiles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(48) NOT NULL,
        "name" varchar(120) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "color" varchar(16) NOT NULL DEFAULT '#2563C9',
        "realm_roles" text[] NOT NULL DEFAULT '{}',
        "groups" text[] NOT NULL DEFAULT '{}',
        "gitea_teams" text[] NOT NULL DEFAULT '{}',
        "chat_channels" text[] NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_access_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "uq_access_profiles_code" UNIQUE ("code")
      )`);

    await queryRunner.query(`CREATE SEQUENCE "employee_number_seq" START 1`);

    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_number" varchar(20) NOT NULL,
        "first_name" varchar(80) NOT NULL,
        "last_name" varchar(80) NOT NULL,
        "personal_email" varchar(160) NOT NULL,
        "work_email" varchar(160) NOT NULL,
        "username" varchar(22) NOT NULL,
        "job_title" varchar(120) NOT NULL,
        "department" varchar(80) NOT NULL,
        "location" varchar(80),
        "contract_type" varchar(16) NOT NULL DEFAULT 'CDI',
        "manager_name" varchar(120),
        "manager_email" varchar(160),
        "start_date" date NOT NULL,
        "end_date" date,
        "status" varchar(24) NOT NULL DEFAULT 'PENDING',
        "access_profile_id" uuid NOT NULL,
        "extra_realm_roles" text[] NOT NULL DEFAULT '{}',
        "extra_access_justification" text,
        "keycloak_user_id" varchar(64),
        "gitea_username" varchar(64),
        "chat_user_id" varchar(64),
        "created_by" varchar(120) NOT NULL,
        "departed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_employees" PRIMARY KEY ("id"),
        CONSTRAINT "uq_employees_number" UNIQUE ("employee_number"),
        CONSTRAINT "uq_employees_work_email" UNIQUE ("work_email"),
        CONSTRAINT "uq_employees_username" UNIQUE ("username"),
        CONSTRAINT "fk_employees_profile" FOREIGN KEY ("access_profile_id")
          REFERENCES "access_profiles"("id") ON DELETE RESTRICT,
        CONSTRAINT "ck_employees_dates" CHECK ("end_date" IS NULL OR "end_date" >= "start_date")
      )`);
    await queryRunner.query(`CREATE INDEX "ix_employees_department" ON "employees" ("department")`);
    await queryRunner.query(`CREATE INDEX "ix_employees_status" ON "employees" ("status")`);
    await queryRunner.query(`CREATE INDEX "ix_employees_start_date" ON "employees" ("start_date")`);
    await queryRunner.query(
      `CREATE INDEX "ix_employees_search" ON "employees" (lower("last_name"), lower("first_name"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "workflow_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" varchar(16) NOT NULL,
        "status" varchar(16) NOT NULL,
        "employee_id" uuid NOT NULL,
        "triggered_by" varchar(120) NOT NULL,
        "reason" text,
        "scheduled_for" timestamptz,
        "idempotency_key" varchar(80),
        "n8n_execution_id" varchar(64),
        "attempt" int NOT NULL DEFAULT 1,
        "options" jsonb,
        "error" text,
        "started_at" timestamptz,
        "finished_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_workflow_runs" PRIMARY KEY ("id"),
        CONSTRAINT "uq_workflow_runs_idempotency" UNIQUE ("idempotency_key"),
        CONSTRAINT "fk_workflow_runs_employee" FOREIGN KEY ("employee_id")
          REFERENCES "employees"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "ix_workflow_runs_type" ON "workflow_runs" ("type")`);
    await queryRunner.query(`CREATE INDEX "ix_workflow_runs_status" ON "workflow_runs" ("status")`);
    await queryRunner.query(`CREATE INDEX "ix_workflow_runs_employee" ON "workflow_runs" ("employee_id")`);
    await queryRunner.query(`CREATE INDEX "ix_workflow_runs_scheduled" ON "workflow_runs" ("scheduled_for")`);

    await queryRunner.query(`
      CREATE TABLE "workflow_steps" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "run_id" uuid NOT NULL,
        "key" varchar(64) NOT NULL,
        "label" varchar(120) NOT NULL,
        "system" varchar(16) NOT NULL,
        "position" int NOT NULL,
        "critical" boolean NOT NULL DEFAULT false,
        "status" varchar(16) NOT NULL DEFAULT 'PENDING',
        "detail" text,
        "meta" jsonb,
        "started_at" timestamptz,
        "finished_at" timestamptz,
        CONSTRAINT "pk_workflow_steps" PRIMARY KEY ("id"),
        CONSTRAINT "uq_workflow_steps_run_key" UNIQUE ("run_id", "key"),
        CONSTRAINT "fk_workflow_steps_run" FOREIGN KEY ("run_id")
          REFERENCES "workflow_runs"("id") ON DELETE CASCADE
      )`);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" bigint GENERATED ALWAYS AS IDENTITY,
        "occurred_at" timestamptz NOT NULL,
        "actor_type" varchar(16) NOT NULL,
        "actor_id" varchar(64) NOT NULL,
        "actor_name" varchar(120) NOT NULL,
        "action" varchar(64) NOT NULL,
        "target_type" varchar(32),
        "target_id" varchar(64),
        "target_label" varchar(160),
        "summary" text NOT NULL,
        "metadata" jsonb,
        "ip" varchar(64),
        "user_agent" varchar(256),
        "prev_hash" char(64) NOT NULL,
        "hash" char(64) NOT NULL,
        CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "uq_audit_logs_hash" UNIQUE ("hash")
      )`);
    await queryRunner.query(`CREATE INDEX "ix_audit_logs_occurred_at" ON "audit_logs" ("occurred_at")`);
    await queryRunner.query(`CREATE INDEX "ix_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "ix_audit_logs_target" ON "audit_logs" ("target_id")`);

    // Le journal d'audit est en ajout seul, même pour un utilisateur SQL disposant des droits d'écriture.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs est en ajout seul : % interdit', TG_OP
          USING ERRCODE = 'insufficient_privilege';
      END;
      $$ LANGUAGE plpgsql`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_audit_logs_no_update_delete"
        BEFORE UPDATE OR DELETE ON "audit_logs"
        FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only()`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_audit_logs_no_truncate"
        BEFORE TRUNCATE ON "audit_logs"
        FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS audit_logs_append_only()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workflow_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employees"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "employee_number_seq"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_profiles"`);
  }
}
