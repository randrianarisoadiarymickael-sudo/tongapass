import { SetMetadata } from '@nestjs/common';
import { AppRole } from '../enums';

export const ROLES_KEY = 'roles';
/** Restreint une route aux rôles listés (principe du moindre privilège). */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
