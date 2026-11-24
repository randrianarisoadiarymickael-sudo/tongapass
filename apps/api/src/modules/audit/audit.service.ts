import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { paginate, Paginated } from '../../common/dto/pagination.dto';
import type { ActorContext } from '../../common/types';
import { computeAuditHash, GENESIS_HASH, HashableAuditEntry } from '../../common/utils/hash-chain.util';
import { AuditLog } from './audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';

/** Verrou consultatif PostgreSQL qui sérialise l'écriture de la chaîne de hachage. */
const AUDIT_CHAIN_LOCK = 727_274_001;

export interface AuditEntryInput {
  action: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrityReport {
  valid: boolean;
  checked: number;
  brokenAtId: string | null;
  lastHash: string | null;
  verifiedAt: string;
}

@Injectable()
export class AuditService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Ajoute une entrée au journal. Si un EntityManager transactionnel est fourni,
   * l'entrée est écrite dans la même transaction que l'opération métier (atomicité).
   */
  async record(actor: ActorContext, input: AuditEntryInput, manager?: EntityManager): Promise<AuditLog> {
    const write = async (em: EntityManager): Promise<AuditLog> => {
      await em.query('SELECT pg_advisory_xact_lock($1)', [AUDIT_CHAIN_LOCK]);
      const last = await em
        .getRepository(AuditLog)
        .createQueryBuilder('log')
        .select(['log.hash'])
        .orderBy('log.id', 'DESC')
        .limit(1)
        .getOne();
      const prevHash = last?.hash ?? GENESIS_HASH;
      const entry: HashableAuditEntry = {
        occurredAt: new Date(),
        actorType: actor.type,
        actorId: actor.id,
        actorName: actor.name,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? null,
        summary: input.summary,
        metadata: input.metadata ?? null,
        ip: actor.ip ?? null,
      };
      const log = em.getRepository(AuditLog).create({
        ...entry,
        actorType: actor.type,
        userAgent: actor.userAgent ?? null,
        prevHash,
        hash: computeAuditHash(prevHash, entry),
      });
      return em.getRepository(AuditLog).save(log);
    };

    if (manager?.queryRunner?.isTransactionActive) return write(manager);
    return this.dataSource.transaction(write);
  }

  async list(query: AuditQueryDto): Promise<Paginated<AuditLog>> {
    const qb = this.dataSource.getRepository(AuditLog).createQueryBuilder('log');
    if (query.action) qb.andWhere('log.action LIKE :action', { action: `${query.action}%` });
    if (query.actorType) qb.andWhere('log.actorType = :actorType', { actorType: query.actorType });
    if (query.targetId) qb.andWhere('log.targetId = :targetId', { targetId: query.targetId });
    if (query.from) qb.andWhere('log.occurredAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('log.occurredAt <= :to', { to: query.to });
    if (query.search) {
      qb.andWhere(
        '(log.summary ILIKE :search OR log.actorName ILIKE :search OR log.targetLabel ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    qb.orderBy('log.id', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query.page, query.pageSize);
  }

  /** Recalcule toute la chaîne : la moindre modification d'une ligne est détectée. */
  async verifyIntegrity(): Promise<IntegrityReport> {
    const repo = this.dataSource.getRepository(AuditLog);
    const batchSize = 500;
    let prevHash = GENESIS_HASH;
    let checked = 0;
    let lastId = '0';

    for (;;) {
      const batch = await repo
        .createQueryBuilder('log')
        .where('log.id > :lastId', { lastId })
        .orderBy('log.id', 'ASC')
        .limit(batchSize)
        .getMany();
      if (batch.length === 0) break;

      for (const log of batch) {
        const expected = computeAuditHash(prevHash, {
          occurredAt: log.occurredAt,
          actorType: log.actorType,
          actorId: log.actorId,
          actorName: log.actorName,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          targetLabel: log.targetLabel,
          summary: log.summary,
          metadata: log.metadata,
          ip: log.ip,
        });
        if (log.prevHash !== prevHash || log.hash !== expected) {
          return {
            valid: false,
            checked,
            brokenAtId: log.id,
            lastHash: prevHash,
            verifiedAt: new Date().toISOString(),
          };
        }
        prevHash = log.hash;
        checked += 1;
        lastId = log.id;
      }
    }

    return {
      valid: true,
      checked,
      brokenAtId: null,
      lastHash: checked > 0 ? prevHash : null,
      verifiedAt: new Date().toISOString(),
    };
  }

  /** Export CSV (séparateur « ; » pour Excel FR), protégé contre l'injection de formules. */
  async exportCsv(query: AuditQueryDto): Promise<string> {
    const page = await this.list({ ...query, page: 1, pageSize: 100 });
    const rows: AuditLog[] = [...page.items];
    for (let p = 2; p <= Math.min(page.totalPages, 100); p += 1) {
      rows.push(...(await this.list({ ...query, page: p, pageSize: 100 })).items);
    }
    const header = ['id', 'date', 'acteur', 'type_acteur', 'action', 'cible', 'resume', 'ip', 'hash'];
    const lines = rows.map((log) =>
      [
        log.id,
        log.occurredAt.toISOString(),
        log.actorName,
        log.actorType,
        log.action,
        log.targetLabel ?? log.targetId ?? '',
        log.summary,
        log.ip ?? '',
        log.hash,
      ]
        .map(csvCell)
        .join(';'),
    );
    const BOM = String.fromCharCode(0xfeff); // pour qu'Excel détecte l'UTF-8
    return `${BOM}${header.join(';')}\n${lines.join('\n')}\n`;
  }
}

export function csvCell(value: string): string {
  let cell = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[";\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}
