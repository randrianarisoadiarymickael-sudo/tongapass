import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { Actor } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('Employés')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Annuaire des employés (recherche, filtres, tri, pagination)' })
  list(@Query() query: EmployeeQueryDto) {
    return this.employees.list(query);
  }

  @Get('export')
  @Roles(AppRole.HR, AppRole.AUDITOR)
  @ApiOperation({ summary: 'Exporter l’annuaire filtré au format CSV' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="tongapass-annuaire.csv"')
  async export(@Query() query: EmployeeQueryDto, @Actor() actor: ActorContext) {
    const csv = await this.employees.exportCsv(query);
    await this.audit.record(actor, { action: 'employees.exported', summary: 'Export CSV de l’annuaire' });
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get('departments')
  @ApiOperation({ summary: 'Départements connus (pour les filtres et l’autocomplétion)' })
  departments() {
    return this.employees.departments();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fiche employé : accès effectifs et historique des workflows' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.detail(id);
  }

  @Get(':id/history')
  @Roles(AppRole.HR, AppRole.AUDITOR)
  @ApiOperation({ summary: 'Historique d’audit de l’employé (toutes les actions le concernant)' })
  history(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationQueryDto) {
    return this.audit.list({ targetId: id, page: query.page, pageSize: query.pageSize });
  }

  @Patch(':id')
  @Roles(AppRole.HR)
  @ApiOperation({ summary: 'Mettre à jour les informations RH (poste, service, manager)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto, @Actor() actor: ActorContext) {
    return this.employees.update(id, dto, actor);
  }
}
