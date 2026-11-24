import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ActorType } from '../../common/enums';

/**
 * Journal d'audit en ajout seul : un déclencheur PostgreSQL interdit UPDATE,
 * DELETE et TRUNCATE, et chaque ligne est chaînée à la précédente par SHA-256.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id: string;

  @Index()
  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ name: 'actor_type', type: 'varchar', length: 16 })
  actorType: ActorType;

  @Column({ name: 'actor_id', type: 'varchar', length: 64 })
  actorId: string;

  @Column({ name: 'actor_name', type: 'varchar', length: 120 })
  actorName: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'target_type', type: 'varchar', length: 32, nullable: true })
  targetType: string | null;

  @Index()
  @Column({ name: 'target_id', type: 'varchar', length: 64, nullable: true })
  targetId: string | null;

  @Column({ name: 'target_label', type: 'varchar', length: 160, nullable: true })
  targetLabel: string | null;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 256, nullable: true })
  userAgent: string | null;

  @Column({ name: 'prev_hash', type: 'char', length: 64 })
  prevHash: string;

  @Column({ type: 'char', length: 64, unique: true })
  hash: string;
}
