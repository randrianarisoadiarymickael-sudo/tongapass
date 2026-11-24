/**
 * Tests de bout en bout de l'API sur une vraie base PostgreSQL.
 * Keycloak est remplacé par un jeu de clés JWKS local (mêmes contrôles : signature,
 * émetteur, audience), n8n par un faux client qui enregistre les déclenchements.
 */
import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT, type KeyLike } from 'jose';
import request from 'supertest';
import { DataSource } from 'typeorm';

const TEST_ENV = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  DATABASE_HOST: process.env.DATABASE_HOST ?? 'localhost',
  DATABASE_PORT: process.env.DATABASE_PORT ?? '5434',
  DATABASE_USER: process.env.DATABASE_USER ?? 'tongapass',
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? 'tongapass',
  DATABASE_NAME: process.env.DATABASE_NAME ?? 'tongapass_test',
  KEYCLOAK_ISSUER: 'http://keycloak.test/realms/tongapass',
  KEYCLOAK_JWKS_URI: 'http://keycloak.test/realms/tongapass/protocol/openid-connect/certs',
  KEYCLOAK_AUDIENCE: 'tongapass-api',
  N8N_WEBHOOK_TOKEN: 'test-webhook-token-0123456789abcdef',
  AUTOMATION_HMAC_SECRET: 'test-hmac-secret-0123456789abcdef0123456789',
  THROTTLE_LIMIT: '10000',
};
Object.assign(process.env, TEST_ENV);

// Imports après la configuration de l'environnement (le schéma de config est évalué au chargement)
/* eslint-disable @typescript-eslint/no-require-imports */
const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
const { configureApp } = require('../src/bootstrap') as typeof import('../src/bootstrap');
const { buildDataSourceOptions, databaseSettingsFromEnv } =
  require('../src/database/typeorm.options') as typeof import('../src/database/typeorm.options');
const { TOKEN_VERIFIER, claimsToUser } =
  require('../src/modules/auth/token-verifier.service') as typeof import('../src/modules/auth/token-verifier.service');
const { N8nClient } = require('../src/modules/workflows/n8n.client') as typeof import('../src/modules/workflows/n8n.client');
const { signPayload } = require('../src/common/utils/hmac.util') as typeof import('../src/common/utils/hmac.util');
const { KeycloakDirectoryClient } =
  require('../src/modules/compliance/keycloak-directory.client') as typeof import('../src/modules/compliance/keycloak-directory.client');
/* eslint-enable @typescript-eslint/no-require-imports */

jest.setTimeout(60_000);

describe('TongaPass API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let privateKey: KeyLike;
  const triggers: { type: string; payload: Record<string, unknown> }[] = [];
  let n8nAvailable = true;
  /** Annuaire Keycloak simulé pour le contrôle de conformité (nom d'utilisateur → état réel). */
  const directory = new Map<string, { id: string; username: string; enabled: boolean; realmRoles: string[]; groups: string[] }>();

  const token = async (roles: string[], username = 'rh.manager') =>
    new SignJWT({
      preferred_username: username,
      name: username === 'rh.manager' ? 'Hanta Rasoanaivo' : username,
      realm_access: { roles },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(TEST_ENV.KEYCLOAK_ISSUER)
      .setAudience(TEST_ENV.KEYCLOAK_AUDIENCE)
      .setSubject(`sub-${username}`)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

  let hr: string;
  let auditor: string;
  let admin: string;

  const signed = (body: object, secret = TEST_ENV.AUTOMATION_HMAC_SECRET) => {
    const raw = JSON.stringify(body);
    const ts = String(Math.floor(Date.now() / 1000));
    return { raw, ts, signature: signPayload(secret, ts, raw) };
  };

  const sendEvent = (body: object) => {
    const { raw, ts, signature } = signed(body);
    return request(app.getHttpServer())
      .post('/api/v1/automation/events')
      .set('Content-Type', 'application/json')
      .set('X-TongaPass-Timestamp', ts)
      .set('X-TongaPass-Signature', signature)
      .send(raw);
  };

  const http = () => request(app.getHttpServer());
  let profileId: string;

  beforeAll(async () => {
    // Base de test vierge, puis migrations réelles
    dataSource = new DataSource(buildDataSourceOptions(databaseSettingsFromEnv()));
    await dataSource.initialize();
    await dataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
    await dataSource.runMigrations();

    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;
    const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256' };
    const jwks = createLocalJWKSet({ keys: [jwk] });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue({
        verify: async (jwt: string) => {
          const { payload } = await jwtVerify(jwt, jwks, {
            issuer: TEST_ENV.KEYCLOAK_ISSUER,
            audience: TEST_ENV.KEYCLOAK_AUDIENCE,
          });
          return claimsToUser(payload, TEST_ENV.KEYCLOAK_AUDIENCE);
        },
      })
      .overrideProvider(KeycloakDirectoryClient)
      .useValue({
        enabled: true,
        findUser: async (_id: string | null, username: string) => directory.get(username) ?? null,
      })
      .overrideProvider(N8nClient)
      .useValue({
        trigger: async (type: string, payload: Record<string, unknown>) => {
          if (!n8nAvailable) throw new Error('n8n injoignable (simulation)');
          triggers.push({ type, payload });
          return { executionId: String(triggers.length) };
        },
      })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true, logger: ['error'] });
    configureApp(app as NestExpressApplication);
    await app.init();

    hr = await token(['tp-hr']);
    auditor = await token(['tp-auditor'], 'auditeur');
    admin = await token(['tp-admin'], 'admin.it');
  });

  afterAll(async () => {
    await app?.close();
    await dataSource?.destroy();
  });

  describe('sécurité et contrôle d’accès', () => {
    it('expose une sonde de santé publique', async () => {
      const res = await http().get('/api/v1/health').expect(200);
      expect(res.body.status).toBe('ok');
    });

    it('refuse une requête sans jeton (RFC 9457)', async () => {
      const res = await http().get('/api/v1/employees').expect(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 401, title: 'Authentification requise' });
    });

    it('refuse un jeton signé par une autre clé', async () => {
      const other = await generateKeyPair('RS256');
      const forged = await new SignJWT({ realm_access: { roles: ['tp-admin'] } })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(TEST_ENV.KEYCLOAK_ISSUER)
        .setAudience(TEST_ENV.KEYCLOAK_AUDIENCE)
        .setExpirationTime('5m')
        .sign(other.privateKey);
      await http().get('/api/v1/employees').set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('refuse un compte authentifié sans rôle TongaPass (403)', async () => {
      const employee = await token(['employee', 'developer'], 'dev.lambda');
      await http().get('/api/v1/employees').set('Authorization', `Bearer ${employee}`).expect(403);
    });

    it('interdit à un auditeur de déclarer une arrivée', async () => {
      await http().post('/api/v1/onboarding').set('Authorization', `Bearer ${auditor}`).send({}).expect(403);
    });

    it('interdit au RH de lire le journal d’audit', async () => {
      await http().get('/api/v1/audit-logs').set('Authorization', `Bearer ${hr}`).expect(403);
    });

    it('expose les permissions dérivées des rôles', async () => {
      const res = await http().get('/api/v1/me').set('Authorization', `Bearer ${hr}`).expect(200);
      expect(res.body.permissions).toEqual({
        manageEmployees: true,
        manageProfiles: false,
        viewAudit: false,
        viewIntegrations: false,
      });
    });
  });

  describe('profils d’accès', () => {
    it('liste les profils initiaux', async () => {
      const res = await http().get('/api/v1/access-profiles').set('Authorization', `Bearer ${hr}`).expect(200);
      expect(res.body.length).toBe(6);
      profileId = res.body.find((p: { code: string }) => p.code === 'dev-backend').id;
    });

    it('refuse un rôle hors catalogue (anti-escalade de privilèges)', async () => {
      const res = await http()
        .post('/api/v1/access-profiles')
        .set('Authorization', `Bearer ${admin}`)
        .send({ code: 'pirate', name: 'Pirate', realmRoles: ['employee', 'tp-admin'], groups: [], giteaTeams: [], chatChannels: [] })
        .expect(400);
      expect(res.body.errors[0].field).toBe('realmRoles');
    });

    it('impose le rôle socle « employee »', async () => {
      await http()
        .post('/api/v1/access-profiles')
        .set('Authorization', `Bearer ${admin}`)
        .send({ code: 'sans-socle', name: 'Sans socle', realmRoles: ['developer'], groups: [], giteaTeams: [], chatChannels: [] })
        .expect(400);
    });
  });

  describe('arrivée (onboarding)', () => {
    const arrival = () => ({
      firstName: 'hanitra',
      lastName: 'RAKOTOMALALA',
      personalEmail: 'Hanitra.Rakoto@Example.org',
      jobTitle: 'Développeuse back-end',
      department: 'Engineering',
      contractType: 'CDI',
      startDate: new Date().toISOString().slice(0, 10),
      managerName: 'Toky Andrianina',
      managerEmail: 'toky.andrianina@tongapass.local',
      accessProfileId: profileId,
    });
    let runId: string;
    let employeeId: string;

    it('prévisualise l’identité et les droits', async () => {
      const res = await http()
        .post('/api/v1/onboarding/preview')
        .set('Authorization', `Bearer ${hr}`)
        .send({ firstName: 'Hanitra', lastName: 'Rakotomalala', accessProfileId: profileId })
        .expect(200);
      expect(res.body.identity).toEqual({
        username: 'hanitra.rakotomalala',
        workEmail: 'hanitra.rakotomalala@tongapass.local',
      });
      expect(res.body.access.realmRoles).toEqual(['employee', 'developer']);
    });

    it('valide les champs et renvoie les erreurs par champ', async () => {
      const res = await http()
        .post('/api/v1/onboarding')
        .set('Authorization', `Bearer ${hr}`)
        .send({ ...arrival(), personalEmail: 'pas-un-email', extraRealmRoles: ['devops'] })
        .expect(400);
      const fields = res.body.errors.map((e: { field: string }) => e.field);
      expect(fields).toEqual(expect.arrayContaining(['personalEmail', 'extraAccessJustification']));
    });

    it('crée l’employé et déclenche le workflow n8n', async () => {
      const res = await http()
        .post('/api/v1/onboarding')
        .set('Authorization', `Bearer ${hr}`)
        .set('Idempotency-Key', 'arrivee-hanitra-0001')
        .send(arrival())
        .expect(202);
      runId = res.body.id;
      employeeId = res.body.employee.id;
      expect(res.body.status).toBe('RUNNING');
      expect(res.body.employee.username).toBe('hanitra.rakotomalala');

      const trigger = triggers.at(-1)!;
      expect(trigger.type).toBe('ONBOARDING');
      expect(trigger.payload).toMatchObject({
        runId,
        employee: { firstName: 'Hanitra', lastName: 'Rakotomalala', personalEmail: 'hanitra.rakoto@example.org' },
        access: { realmRoles: ['employee', 'developer'], giteaTeams: ['developers'] },
      });
    });

    it('est idempotent (double soumission)', async () => {
      const res = await http()
        .post('/api/v1/onboarding')
        .set('Authorization', `Bearer ${hr}`)
        .set('Idempotency-Key', 'arrivee-hanitra-0001')
        .send(arrival())
        .expect(202);
      expect(res.body.id).toBe(runId);
    });

    it('refuse un doublon sur l’adresse personnelle', async () => {
      await http().post('/api/v1/onboarding').set('Authorization', `Bearer ${hr}`).send(arrival()).expect(409);
    });

    it('rejette un callback non signé ou mal signé', async () => {
      await http().post('/api/v1/automation/events').send({ runId, event: 'step' }).expect(401);
      const { raw, ts } = signed({ runId, event: 'run.finished' });
      await http()
        .post('/api/v1/automation/events')
        .set('Content-Type', 'application/json')
        .set('X-TongaPass-Timestamp', ts)
        .set('X-TongaPass-Signature', signPayload('mauvais-secret', ts, raw))
        .send(raw)
        .expect(401);
    });

    it('fait avancer les étapes et active l’employé', async () => {
      await sendEvent({ runId, event: 'step', step: 'keycloak.account', status: 'SUCCEEDED', detail: 'Compte prêt', meta: { userId: 'kc-123', password: 'ne-doit-pas-etre-stocke' } }).expect(200);
      await sendEvent({ runId, event: 'step', step: 'keycloak.roles', status: 'SUCCEEDED' }).expect(200);
      await sendEvent({ runId, event: 'step', step: 'keycloak.activation', status: 'SUCCEEDED' }).expect(200);
      await sendEvent({ runId, event: 'step', step: 'gitea.account', status: 'SUCCEEDED', meta: { username: 'hanitra.rakotomalala' } }).expect(200);
      await sendEvent({ runId, event: 'step', step: 'chat.invite', status: 'FAILED', detail: 'Mattermost injoignable' }).expect(200);
      await sendEvent({ runId, event: 'step', step: 'email.welcome', status: 'SUCCEEDED' }).expect(200);
      const finished = await sendEvent({ runId, event: 'run.finished' }).expect(200);
      expect(finished.body).toEqual({ accepted: true, status: 'PARTIAL' });

      const run = await http().get(`/api/v1/workflow-runs/${runId}`).set('Authorization', `Bearer ${hr}`).expect(200);
      const account = run.body.steps.find((s: { key: string }) => s.key === 'keycloak.account');
      expect(account.meta).toEqual({ userId: 'kc-123' }); // le champ « password » a été filtré

      const employee = await http().get(`/api/v1/employees/${employeeId}`).set('Authorization', `Bearer ${hr}`).expect(200);
      expect(employee.body.status).toBe('ACTIVE');
      expect(employee.body.keycloakUserId).toBe('kc-123');
      expect(employee.body.giteaUsername).toBe('hanitra.rakotomalala');
    });

    it('ignore un événement tardif sur une exécution close', async () => {
      const res = await sendEvent({ runId, event: 'step', step: 'chat.invite', status: 'SUCCEEDED' }).expect(200);
      expect(res.body.accepted).toBe(false);
    });

    it('relance une exécution partielle (tentative 2)', async () => {
      const res = await http().post(`/api/v1/workflow-runs/${runId}/retry`).set('Authorization', `Bearer ${hr}`).expect(202);
      expect(res.body.attempt).toBe(2);
      expect(res.body.status).toBe('RUNNING');
      const retryRunId = res.body.id;
      for (const step of ['keycloak.account', 'keycloak.roles', 'keycloak.activation', 'gitea.account', 'chat.invite', 'email.welcome']) {
        await sendEvent({ runId: retryRunId, event: 'step', step, status: 'SUCCEEDED' }).expect(200);
      }
      const done = await sendEvent({ runId: retryRunId, event: 'run.finished' }).expect(200);
      expect(done.body.status).toBe('SUCCEEDED');
    });

    it('marque l’arrivée en échec si n8n est injoignable, puis permet la relance', async () => {
      n8nAvailable = false;
      const res = await http()
        .post('/api/v1/onboarding')
        .set('Authorization', `Bearer ${hr}`)
        .send({ ...arrival(), firstName: 'Tiana', lastName: 'Randria', personalEmail: 'tiana@example.org' })
        .expect(202);
      expect(res.body.status).toBe('FAILED');
      n8nAvailable = true;
      const retried = await http().post(`/api/v1/workflow-runs/${res.body.id}/retry`).set('Authorization', `Bearer ${hr}`).expect(202);
      expect(retried.body.status).toBe('RUNNING');
    });
  });

  describe('départ (offboarding)', () => {
    let employeeId: string;

    beforeAll(async () => {
      const list = await http().get('/api/v1/employees').query({ search: 'hanitra' }).set('Authorization', `Bearer ${hr}`).expect(200);
      employeeId = list.body.items[0].id;
    });

    it('exige la confirmation exacte de l’identifiant', async () => {
      await http()
        .post('/api/v1/offboarding')
        .set('Authorization', `Bearer ${hr}`)
        .send({ employeeId, reason: 'RESIGNATION', confirmUsername: 'hanitra' })
        .expect(400);
    });

    it('planifie puis annule un départ', async () => {
      const effectiveAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
      const scheduled = await http()
        .post('/api/v1/offboarding')
        .set('Authorization', `Bearer ${hr}`)
        .send({ employeeId, reason: 'END_OF_CONTRACT', confirmUsername: 'hanitra.rakotomalala', effectiveAt })
        .expect(202);
      expect(scheduled.body.status).toBe('SCHEDULED');
      const cancelled = await http().post(`/api/v1/offboarding/${scheduled.body.id}/cancel`).set('Authorization', `Bearer ${hr}`).expect(200);
      expect(cancelled.body.status).toBe('CANCELLED');
      expect(cancelled.body.employee.status).toBe('ACTIVE');
    });

    it('révoque immédiatement tous les accès', async () => {
      const res = await http()
        .post('/api/v1/offboarding')
        .set('Authorization', `Bearer ${hr}`)
        .send({ employeeId, reason: 'RESIGNATION', comment: 'Passation faite', confirmUsername: 'hanitra.rakotomalala' })
        .expect(202);
      expect(res.body.status).toBe('RUNNING');
      const payload = triggers.at(-1)!.payload as { type: string; employee: { keycloakUserId: string } };
      expect(payload.type).toBe('OFFBOARDING');
      expect(payload.employee.keycloakUserId).toBe('kc-123');

      for (const step of ['keycloak.disable', 'keycloak.sessions', 'keycloak.roles', 'gitea.revoke', 'chat.deactivate', 'email.notify']) {
        await sendEvent({ runId: res.body.id, event: 'step', step, status: 'SUCCEEDED' }).expect(200);
      }
      await sendEvent({ runId: res.body.id, event: 'run.finished' }).expect(200);
      const employee = await http().get(`/api/v1/employees/${employeeId}`).set('Authorization', `Bearer ${hr}`).expect(200);
      expect(employee.body.status).toBe('DEPARTED');
      expect(employee.body.departedAt).not.toBeNull();
    });

    it('rend la fiche d’un employé parti non modifiable', async () => {
      await http().patch(`/api/v1/employees/${employeeId}`).set('Authorization', `Bearer ${hr}`).send({ jobTitle: 'Autre' }).expect(409);
    });
  });

  describe('journal d’audit', () => {
    it('trace les actions humaines et automatiques', async () => {
      const res = await http().get('/api/v1/audit-logs').query({ action: 'access.' }).set('Authorization', `Bearer ${auditor}`).expect(200);
      expect(res.body.total).toBeGreaterThan(5);
      expect(res.body.items[0].actorType).toBe('AUTOMATION');
    });

    it('vérifie la chaîne de hachage', async () => {
      const res = await http().get('/api/v1/audit-logs/integrity').set('Authorization', `Bearer ${auditor}`).expect(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.checked).toBeGreaterThan(10);
    });

    it('interdit toute modification en base (déclencheur append-only)', async () => {
      await expect(dataSource.query(`UPDATE audit_logs SET summary = 'falsifié' WHERE id = 1`)).rejects.toThrow(/ajout seul/);
      await expect(dataSource.query(`DELETE FROM audit_logs`)).rejects.toThrow(/ajout seul/);
    });

    it('exporte en CSV', async () => {
      const res = await http().get('/api/v1/audit-logs/export').set('Authorization', `Bearer ${auditor}`).expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text.split('\n')[0]).toContain('id;date;acteur');
    });
  });

  // Aide : déclare une arrivée et la mène à son terme avec des rappels signés
  const completeArrival = async (body: Record<string, unknown>) => {
    const res = await http().post('/api/v1/onboarding').set('Authorization', `Bearer ${hr}`).send(body).expect(202);
    for (const step of ['keycloak.account', 'keycloak.roles', 'keycloak.activation', 'gitea.account', 'chat.invite', 'email.welcome']) {
      await sendEvent({ runId: res.body.id, event: 'step', step, status: 'SUCCEEDED', meta: step === 'keycloak.account' ? { userId: `kc-${res.body.employee.username}` } : {} }).expect(200);
    }
    await sendEvent({ runId: res.body.id, event: 'run.finished' }).expect(200);
    return res.body as { id: string; employee: { id: string; username: string } };
  };

  const today = () => new Date().toISOString().slice(0, 10);
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const baseArrival = (firstName: string, lastName: string) => ({
    firstName,
    lastName,
    personalEmail: `${firstName}.${lastName}@example.org`.toLowerCase(),
    jobTitle: 'Développeur back-end',
    department: 'Engineering',
    contractType: 'CDI',
    startDate: today(),
    accessProfileId: profileId,
  });

  describe('arrivée planifiée', () => {
    it('diffère la création des comptes puis permet l’annulation', async () => {
      const before = triggers.length;
      const provisionAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
      const res = await http()
        .post('/api/v1/onboarding')
        .set('Authorization', `Bearer ${hr}`)
        .send({ ...baseArrival('Mialy', 'Rakotoarisoa'), startDate: inDays(3), provisionAt })
        .expect(202);
      expect(res.body.status).toBe('SCHEDULED');
      expect(res.body.employee.status).toBe('PENDING');
      expect(triggers.length).toBe(before); // aucun compte créé à l'avance

      const cancelled = await http().post(`/api/v1/onboarding/${res.body.id}/cancel`).set('Authorization', `Bearer ${hr}`).expect(200);
      expect(cancelled.body.status).toBe('CANCELLED');
      expect(cancelled.body.employee.status).toBe('CANCELLED');
    });

    it('peut être avancée à maintenant', async () => {
      const res = await http()
        .post('/api/v1/onboarding')
        .set('Authorization', `Bearer ${hr}`)
        .send({ ...baseArrival('Soa', 'Rabemananjara'), startDate: inDays(5), provisionAt: new Date(Date.now() + 3 * 86_400_000).toISOString() })
        .expect(202);
      const now = await http().post(`/api/v1/workflow-runs/${res.body.id}/run-now`).set('Authorization', `Bearer ${hr}`).expect(202);
      expect(now.body.status).toBe('RUNNING');
      expect(triggers.at(-1)!.payload.runId).toBe(res.body.id);
    });
  });

  describe('fin de contrat', () => {
    it('planifie automatiquement la révocation d’un CDD à la date de fin', async () => {
      const arrival = await completeArrival({
        ...baseArrival('Nomena', 'Andriamaro'),
        contractType: 'CDD',
        endDate: inDays(60),
        options: { scheduleDepartureAtEnd: true },
      });
      const employee = await http().get(`/api/v1/employees/${arrival.employee.id}`).set('Authorization', `Bearer ${hr}`).expect(200);
      expect(employee.body.status).toBe('OFFBOARDING_SCHEDULED');
      const departure = employee.body.runs.find((run: { type: string; status: string }) => run.type === 'OFFBOARDING');
      expect(departure.status).toBe('SCHEDULED');
      expect(departure.scheduledFor.slice(0, 10)).toBe(inDays(60));
      const pageOfRuns = (page: number) => http().get('/api/v1/workflow-runs')
        .query({ employeeId: arrival.employee.id, pageSize: 1, page })
        .set('Authorization', `Bearer ${hr}`).expect(200);
      const first = await pageOfRuns(1);
      const second = await pageOfRuns(2);
      expect(first.body.total).toBe(2);
      expect([first.body.items[0].id, second.body.items[0].id].sort()).toEqual([arrival.id, departure.id].sort());
    });
  });

  describe('mobilité', () => {
    let employeeId: string;
    let devopsId: string;

    beforeAll(async () => {
      const arrival = await completeArrival(baseArrival('Toky', 'Randrianasolo'));
      employeeId = arrival.employee.id;
      const profiles = await http().get('/api/v1/access-profiles').set('Authorization', `Bearer ${hr}`).expect(200);
      devopsId = profiles.body.find((p: { code: string }) => p.code === 'devops').id;
    });

    it('prévisualise les droits ajoutés et retirés', async () => {
      const res = await http()
        .post(`/api/v1/employees/${employeeId}/mobility/preview`)
        .set('Authorization', `Bearer ${hr}`)
        .send({ accessProfileId: devopsId })
        .expect(200);
      expect(res.body.added.realmRoles).toEqual(['devops']);
      expect(res.body.removed.realmRoles).toEqual([]);
      expect(res.body.sensitiveAdded).toEqual(expect.arrayContaining(['devops', 'incidents']));
    });

    it('refuse une mobilité sans changement', async () => {
      await http().post(`/api/v1/employees/${employeeId}/mobility`).set('Authorization', `Bearer ${hr}`).send({ accessProfileId: profileId }).expect(400);
    });

    it('ajuste les droits et met à jour la fiche une fois appliqués', async () => {
      const res = await http()
        .post(`/api/v1/employees/${employeeId}/mobility`)
        .set('Authorization', `Bearer ${hr}`)
        .send({ accessProfileId: devopsId, jobTitle: 'Ingénieur DevOps', reason: 'Rejoint l’équipe plateforme' })
        .expect(202);
      expect(res.body.type).toBe('MOBILITY');
      const payload = triggers.at(-1)!.payload as { type: string; mobility: { changes: { added: { realmRoles: string[] } } } };
      expect(payload.type).toBe('MOBILITY');
      expect(payload.mobility.changes.added.realmRoles).toEqual(['devops']);

      const before = await http().get(`/api/v1/employees/${employeeId}`).set('Authorization', `Bearer ${hr}`).expect(200);
      expect(before.body.accessProfileId).toBe(profileId); // inchangé tant que Keycloak n'a pas confirmé

      for (const step of ['keycloak.sync', 'gitea.sync', 'chat.sync', 'email.notify']) {
        await sendEvent({ runId: res.body.id, event: 'step', step, status: 'SUCCEEDED' }).expect(200);
      }
      const done = await sendEvent({ runId: res.body.id, event: 'run.finished' }).expect(200);
      expect(done.body.status).toBe('SUCCEEDED');
      const after = await http().get(`/api/v1/employees/${employeeId}`).set('Authorization', `Bearer ${hr}`).expect(200);
      expect(after.body.accessProfileId).toBe(devopsId);
      expect(after.body.jobTitle).toBe('Ingénieur DevOps');
    });
  });

  describe('conformité des accès', () => {
    let employeeId: string;
    let username: string;

    beforeAll(async () => {
      const arrival = await completeArrival(baseArrival('Fanja', 'Rasolonirina'));
      employeeId = arrival.employee.id;
      username = arrival.employee.username;
    });

    it('déclare conforme un compte qui correspond au profil', async () => {
      directory.set(username, { id: 'kc-x', username, enabled: true, realmRoles: ['employee', 'developer'], groups: ['Engineering'] });
      const res = await http().post(`/api/v1/employees/${employeeId}/compliance`).set('Authorization', `Bearer ${hr}`).expect(200);
      expect(res.body.status).toBe('COMPLIANT');
    });

    it('détecte un rôle administrateur ajouté à la main dans Keycloak', async () => {
      directory.set(username, { id: 'kc-x', username, enabled: true, realmRoles: ['employee', 'developer', 'tp-admin'], groups: ['Engineering'] });
      const res = await http().post(`/api/v1/employees/${employeeId}/compliance`).set('Authorization', `Bearer ${hr}`).expect(200);
      expect(res.body.status).toBe('DRIFT');
      expect(res.body.details.unexpectedRoles).toEqual(['tp-admin']);
    });

    it('signale un compte manquant et produit une synthèse', async () => {
      const scan = await http().post('/api/v1/compliance/scan').set('Authorization', `Bearer ${auditor}`).expect(200);
      expect(scan.body.total).toBeGreaterThan(0);
      expect(scan.body.counts.DRIFT).toBeGreaterThanOrEqual(1);
      expect(scan.body.counts.NO_ACCOUNT).toBeGreaterThanOrEqual(1);
      const latest = await http().get('/api/v1/compliance').set('Authorization', `Bearer ${auditor}`).expect(200);
      expect(latest.body.items[0].status).toBe('DRIFT'); // les écarts en premier
    });

    it('réserve la synthèse globale aux auditeurs', async () => {
      await http().get('/api/v1/compliance').set('Authorization', `Bearer ${hr}`).expect(403);
    });
  });

  describe('historique et export', () => {
    it('retrace toutes les actions concernant un employé', async () => {
      const list = await http().get('/api/v1/employees').query({ search: 'toky' }).set('Authorization', `Bearer ${hr}`).expect(200);
      const res = await http().get(`/api/v1/employees/${list.body.items[0].id}/history`).set('Authorization', `Bearer ${hr}`).expect(200);
      const actions = res.body.items.map((item: { action: string }) => item.action);
      expect(actions).toEqual(expect.arrayContaining(['onboarding.requested', 'mobility.requested', 'mobility.completed']));
    });

    it('exporte l’annuaire en CSV', async () => {
      const res = await http().get('/api/v1/employees/export').set('Authorization', `Bearer ${hr}`).expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('matricule;prenom;nom');
      expect(res.text).toContain('Randrianasolo');
    });
  });

  describe('tableau de bord', () => {
    it('agrège indicateurs, agenda et conformité', async () => {
      const res = await http().get('/api/v1/dashboard').set('Authorization', `Bearer ${hr}`).expect(200);
      expect(res.body.kpis.activeEmployees).toBeGreaterThanOrEqual(2);
      expect(res.body.kpis.scheduledDepartures).toBeGreaterThanOrEqual(1);
      expect(res.body.kpis.mobilitiesThisMonth).toBe(1);
      expect(res.body.monthly).toHaveLength(6);
      expect(res.body.agenda.some((item: { kind: string }) => item.kind === 'ARRIVAL')).toBe(true);
      expect(res.body.compliance.counts.DRIFT).toBeGreaterThanOrEqual(1);
    });
  });
});
