import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { StepStatus } from '../../common/enums';
import { WorkflowRun } from './workflow-run.entity';

export type StepSystem = 'keycloak' | 'gitea' | 'chat' | 'email' | 'core';

@Entity('workflow_steps')
@Unique('uq_workflow_steps_run_key', ['runId', 'key'])
export class WorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WorkflowRun, (run) => run.steps, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run: WorkflowRun;

  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'varchar', length: 16 })
  system: StepSystem;

  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'boolean', default: false })
  critical: boolean;

  @Column({ type: 'varchar', length: 16, default: StepStatus.PENDING })
  status: StepStatus;

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
