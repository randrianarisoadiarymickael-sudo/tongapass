import { Controller, Get, Header, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('Journal d’audit')
@ApiBearerAuth()
@Roles(AppRole.AUDITOR)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les entrées du journal (filtrable, paginé)' })
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }

  @Get('integrity')
  @ApiOperation({ summary: 'Vérifier l’intégrité de la chaîne de hachage SHA-256' })
  @ApiOkResponse({ description: 'Rapport de vérification' })
  async integrity(@Actor() actor: ActorContext) {
    const report = await this.audit.verifyIntegrity();
    await this.audit.record(actor, {
      action: 'audit.verified',
      summary: report.valid
        ? `Intégrité vérifiée sur ${report.checked} entrées`
        : `Rupture de chaîne détectée à l’entrée #${report.brokenAtId}`,
      metadata: { valid: report.valid, checked: report.checked },
    });
    return report;
  }

  @Get('export')
  @ApiOperation({ summary: 'Exporter le journal filtré au format CSV' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="tongapass-audit.csv"')
  async export(@Query() query: AuditQueryDto, @Actor() actor: ActorContext) {
    const csv = await this.audit.exportCsv(query);
    await this.audit.record(actor, {
      action: 'audit.exported',
      summary: 'Export CSV du journal d’audit',
      metadata: { filters: { ...query, page: undefined, pageSize: undefined } },
    });
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }
}
