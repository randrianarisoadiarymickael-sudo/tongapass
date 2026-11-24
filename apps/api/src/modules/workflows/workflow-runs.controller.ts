import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { RunQueryDto } from './dto/run-query.dto';
import { WorkflowsService } from './workflows.service';

@ApiTags('Exécutions')
@ApiBearerAuth()
@Controller('workflow-runs')
export class WorkflowRunsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les exécutions d’arrivée et de départ' })
  list(@Query() query: RunQueryDto) {
    return this.workflows.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une exécution et de ses étapes' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const run = await this.workflows.getRunOrFail(id);
    return { ...this.workflows.toSummary(run), steps: run.steps, options: run.options };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles(AppRole.HR)
  @ApiOperation({ summary: 'Annuler une exécution planifiée (arrivée, mobilité ou départ)' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Actor() actor: ActorContext) {
    return this.workflows.toSummary(await this.workflows.cancelScheduled(id, actor));
  }

  @Post(':id/run-now')
  @HttpCode(202)
  @Roles(AppRole.HR)
  @ApiOperation({ summary: 'Exécuter immédiatement une exécution planifiée (départ anticipé…)' })
  async runNow(@Param('id', ParseUUIDPipe) id: string, @Actor() actor: ActorContext) {
    const run = await this.workflows.runNow(id, actor);
    return { ...this.workflows.toSummary(run), steps: run.steps };
  }

  @Post(':id/retry')
  @HttpCode(202)
  @Roles(AppRole.HR)
  @ApiOperation({ summary: 'Relancer une exécution en échec (les workflows n8n sont idempotents)' })
  async retry(@Param('id', ParseUUIDPipe) id: string, @Actor() actor: ActorContext) {
    const run = await this.workflows.retry(id, actor);
    return { ...this.workflows.toSummary(run), steps: run.steps };
  }
}
