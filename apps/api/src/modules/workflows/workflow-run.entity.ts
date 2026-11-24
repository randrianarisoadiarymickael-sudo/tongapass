import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RunStatus, RunType } from '../../common/enums';
import { Employee } from '../employees/employee.entity';
import { WorkflowStep } from './workflow-step.entity';

/** Une exécution d'automatisation (arrivée ou départ) pour un employé. */
@Entity('workflow_runs')
export class WorkflowRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  type: RunType;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  status: RunStatus;

  @ManyToOne(() => Employee, (employee) => employee.runs, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ name: 'triggered_by', type: 'varchar', length: 120 })
  triggeredBy: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Index()
  @Column({ name: 'scheduled_for', type: 'timestamptz', nullable: true })
  scheduledFor: Date | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 80, nullable: true, unique: true })
  idempotencyKey: string | null;

  @Column({ name: 'n8n_execution_id', type: 'varchar', length: 64, nullable: true })
  n8nExecutionId: string | null;

  @Column({ type: 'int', default: 1 })
  attempt: number;

  @Column({ type: 'jsonb', nullable: true })
  options: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @OneToMany(() => WorkflowStep, (step) => step.run, { cascade: ['insert'] })
  steps: WorkflowStep[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
