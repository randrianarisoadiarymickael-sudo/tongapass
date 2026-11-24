import { DataSourceOptions } from 'typeorm';
import { AccessProfile } from '../modules/access-profiles/access-profile.entity';
import { AuditLog } from '../modules/audit/audit-log.entity';
import { ComplianceCheck } from '../modules/compliance/compliance-check.entity';
import { Employee } from '../modules/employees/employee.entity';
import { WorkflowRun } from '../modules/workflows/workflow-run.entity';
import { WorkflowStep } from '../modules/workflows/workflow-step.entity';
import { InitialSchema1763424000000 } from './migrations/1763424000000-InitialSchema';
import { SeedAccessProfiles1763424100000 } from './migrations/1763424100000-SeedAccessProfiles';
import { ComplianceChecks1763510400000 } from './migrations/1763510400000-ComplianceChecks';
import { ProfileColors1763596800000 } from './migrations/1763596800000-ProfileColors';

export const ENTITIES = [AccessProfile, Employee, WorkflowRun, WorkflowStep, AuditLog, ComplianceCheck];
export const MIGRATIONS = [InitialSchema1763424000000, SeedAccessProfiles1763424100000, ComplianceChecks1763510400000, ProfileColors1763596800000];

export interface DatabaseSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
  ssl: boolean;
  /** Fuseau IANA de l'entreprise : CURRENT_DATE et les bornes de mois sont calculées dans ce fuseau. */
  timezone?: string;
}

const IANA_ZONE = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)*$/;

/** Options communes à l'application et au CLI de migration (jamais de synchronize en production). */
export function buildDataSourceOptions(db: DatabaseSettings): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.user,
    password: db.password,
    database: db.name,
    ssl: db.ssl ? { rejectUnauthorized: true } : false,
    extra: db.timezone && IANA_ZONE.test(db.timezone) ? { options: `-c TimeZone=${db.timezone}` } : undefined,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'schema_migrations',
    synchronize: false,
    logging: ['error', 'warn'],
  };
}

export function databaseSettingsFromEnv(env: NodeJS.ProcessEnv = process.env): DatabaseSettings {
  return {
    host: env.DATABASE_HOST ?? 'localhost',
    port: Number(env.DATABASE_PORT ?? 5432),
    user: env.DATABASE_USER ?? 'tongapass',
    password: env.DATABASE_PASSWORD ?? '',
    name: env.DATABASE_NAME ?? 'tongapass',
    ssl: env.DATABASE_SSL === 'true',
    timezone: env.COMPANY_TIMEZONE ?? 'Indian/Antananarivo',
  };
}
