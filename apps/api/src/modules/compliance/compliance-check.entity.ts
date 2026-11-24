import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ComplianceStatus } from '../../common/enums';
import { Employee } from '../employees/employee.entity';

export interface ComplianceDetails {
  expected: { enabled: boolean; realmRoles: string[]; groups: string[] };
  actual: { exists: boolean; enabled: boolean | null; realmRoles: string[]; groups: string[] } | null;
  missingRoles: string[];
  unexpectedRoles: string[];
  missingGroups: string[];
  unexpectedGroups: string[];
  enabledMismatch: boolean;
  message: string;
}

/** Résultat d'un contrôle de conformité (droits réels dans Keycloak ↔ droits attendus). */
@Entity('compliance_checks')
export class ComplianceCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  status: ComplianceStatus;

  @Column({ type: 'jsonb' })
  details: ComplianceDetails;

  @Column({ name: 'triggered_by', type: 'varchar', length: 120 })
  triggeredBy: string;

  @Index()
  @CreateDateColumn({ name: 'checked_at', type: 'timestamptz' })
  checkedAt: Date;
}
