import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppRole } from '../../common/enums';
import type { AuthenticatedUser } from '../../common/types';
import { AppConfig } from '../../config/configuration';

export function permissionsFor(roles: AppRole[]) {
  const has = (...wanted: AppRole[]) => roles.includes(AppRole.ADMIN) || wanted.some((r) => roles.includes(r));
  return {
    manageEmployees: has(AppRole.HR),
    manageProfiles: has(),
    viewAudit: has(AppRole.AUDITOR),
    viewIntegrations: has(AppRole.AUDITOR),
  };
}

@ApiTags('Session')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  @Get()
  @ApiOperation({ summary: 'Utilisateur connecté, rôles et permissions dérivées' })
  me(@CurrentUser() user: AuthenticatedUser) {
    const company = this.config.get('company', { infer: true });
    const links = this.config.get('publicLinks', { infer: true });
    return {
      ...user,
      permissions: permissionsFor(user.roles),
      workspace: {
        company: company.name,
        emailDomain: company.emailDomain,
        links: {
          n8n: links.n8n || null,
          keycloak: links.keycloak || null,
          gitea: links.gitea || null,
          mattermost: links.mattermost || null,
          mailpit: links.mailpit || null,
          apiDocs: `${this.config.get('publicApiUrl', { infer: true })}/api/docs`,
        },
      },
    };
  }
}
