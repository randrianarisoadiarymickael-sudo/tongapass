import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums';
import { IntegrationsService } from './integrations.service';

@ApiTags('Santé')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get()
  @Public()
  @SkipThrottle()
  @HealthCheck()
  @ApiOperation({ summary: 'Sonde de vivacité / disponibilité (utilisée par Docker et la CI)' })
  check() {
    return this.health.check([() => this.db.pingCheck('database', { timeout: 2000 })]);
  }

  @Get('integrations')
  @ApiBearerAuth()
  @Roles(AppRole.ADMIN, AppRole.AUDITOR)
  @ApiOperation({ summary: 'État des services provisionnés (Keycloak, n8n, Gitea, Mattermost, SMTP)' })
  integrationsStatus() {
    return this.integrations.check();
  }
}
