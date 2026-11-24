import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { ComplianceService } from './compliance.service';

@ApiTags('Conformité des accès')
@ApiBearerAuth()
@Controller()
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('compliance')
  @Roles(AppRole.AUDITOR)
  @ApiOperation({ summary: 'Dernier contrôle de chaque compte (les écarts en premier)' })
  async latest() {
    const [summary, items] = await Promise.all([this.compliance.summary(), this.compliance.latest()]);
    return {
      summary,
      items: items.map((check) => ({
        id: check.id,
        status: check.status,
        checkedAt: check.checkedAt,
        triggeredBy: check.triggeredBy,
        details: check.details,
        employee: {
          id: check.employee.id,
          firstName: check.employee.firstName,
          lastName: check.employee.lastName,
          username: check.employee.username,
          status: check.employee.status,
          profile: { name: check.employee.accessProfile.name, color: check.employee.accessProfile.color },
        },
      })),
    };
  }

  @Post('compliance/scan')
  @HttpCode(200)
  @Roles(AppRole.AUDITOR)
  @ApiOperation({ summary: 'Contrôler maintenant tous les comptes provisionnés contre Keycloak' })
  scan(@Actor() actor: ActorContext) {
    return this.compliance.scan(actor);
  }

  @Get('employees/:id/compliance')
  @Roles(AppRole.HR, AppRole.AUDITOR)
  @ApiOperation({ summary: 'Dernier contrôle de conformité d’un employé' })
  last(@Param('id', ParseUUIDPipe) id: string) {
    return this.compliance.lastForEmployee(id);
  }

  @Post('employees/:id/compliance')
  @HttpCode(200)
  @Roles(AppRole.HR, AppRole.AUDITOR)
  @ApiOperation({ summary: 'Vérifier maintenant les droits réels de l’employé dans Keycloak' })
  check(@Param('id', ParseUUIDPipe) id: string, @Actor() actor: ActorContext) {
    return this.compliance.checkEmployee(id, actor);
  }
}
