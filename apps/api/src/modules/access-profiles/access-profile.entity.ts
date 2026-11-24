import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Profil d'accès (modèle de rôle) : l'ensemble minimal des droits accordés
 * à un poste. C'est la traduction concrète du principe du moindre privilège.
 */
@Entity('access_profiles')
export class AccessProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 48, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'varchar', length: 16, default: '#3B57C2' })
  color: string;

  @Column({ name: 'realm_roles', type: 'text', array: true, default: () => "'{}'" })
  realmRoles: string[];

  @Column({ name: 'groups', type: 'text', array: true, default: () => "'{}'" })
  groups: string[];

  @Column({ name: 'gitea_teams', type: 'text', array: true, default: () => "'{}'" })
  giteaTeams: string[];

  @Column({ name: 'chat_channels', type: 'text', array: true, default: () => "'{}'" })
  chatChannels: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
