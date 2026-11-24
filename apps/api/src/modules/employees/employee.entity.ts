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
import { ContractType, EmployeeStatus } from '../../common/enums';
import { AccessProfile } from '../access-profiles/access-profile.entity';
import { WorkflowRun } from '../workflows/workflow-run.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_number', type: 'varchar', length: 20, unique: true })
  employeeNumber: string;

  @Column({ name: 'first_name', type: 'varchar', length: 80 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 80 })
  lastName: string;

  @Column({ name: 'personal_email', type: 'varchar', length: 160 })
  personalEmail: string;

  @Column({ name: 'work_email', type: 'varchar', length: 160, unique: true })
  workEmail: string;

  @Column({ type: 'varchar', length: 22, unique: true })
  username: string;

  @Column({ name: 'job_title', type: 'varchar', length: 120 })
  jobTitle: string;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  department: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  location: string | null;

  @Column({ name: 'contract_type', type: 'varchar', length: 16, default: ContractType.CDI })
  contractType: ContractType;

  @Column({ name: 'manager_name', type: 'varchar', length: 120, nullable: true })
  managerName: string | null;

  @Column({ name: 'manager_email', type: 'varchar', length: 160, nullable: true })
  managerEmail: string | null;

  @Index()
  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Index()
  @Column({ type: 'varchar', length: 24, default: EmployeeStatus.PENDING })
  status: EmployeeStatus;

  @ManyToOne(() => AccessProfile, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'access_profile_id' })
  accessProfile: AccessProfile;

  @Column({ name: 'access_profile_id', type: 'uuid' })
  accessProfileId: string;

  @Column({ name: 'extra_realm_roles', type: 'text', array: true, default: () => "'{}'" })
  extraRealmRoles: string[];

  @Column({ name: 'extra_access_justification', type: 'text', nullable: true })
  extraAccessJustification: string | null;

  @Column({ name: 'keycloak_user_id', type: 'varchar', length: 64, nullable: true })
  keycloakUserId: string | null;

  @Column({ name: 'gitea_username', type: 'varchar', length: 64, nullable: true })
  giteaUsername: string | null;

  @Column({ name: 'chat_user_id', type: 'varchar', length: 64, nullable: true })
  chatUserId: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 120 })
  createdBy: string;

  @Column({ name: 'departed_at', type: 'timestamptz', nullable: true })
  departedAt: Date | null;

  @OneToMany(() => WorkflowRun, (run) => run.employee)
  runs: WorkflowRun[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
