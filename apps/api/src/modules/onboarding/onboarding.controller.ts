import { BadRequestException, Body, Controller, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { CreateOnboardingDto, PreviewOnboardingDto } from './dto/create-onboarding.dto';
import { WorkflowsService } from '../workflows/workflows.service';
import { OnboardingService } from './onboarding.service';

@ApiTags('Arrivées')
@ApiBearerAuth()
@Roles(AppRole.HR)
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly workflows: WorkflowsService,
  ) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Prévisualiser identifiants et droits avant de lancer l’arrivée' })
  preview(@Body() dto: PreviewOnboardingDto) {
    return this.onboarding.preview(dto);
  }

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Déclarer une arrivée et lancer le provisionnement automatique',
    description:
      'Crée la fiche employé puis déclenche le workflow n8n : compte Keycloak, rôles, Gitea, Mattermost, e-mail de bienvenue.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Évite les doublons en cas de double soumission' })
  @ApiAcceptedResponse({ description: 'Arrivée enregistrée, provisionnement en cours' })
  create(
    @Body() dto: CreateOnboardingDto,
    @Actor() actor: ActorContext,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey && !/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) {
      throw new BadRequestException('En-tête Idempotency-Key invalide');
    }
    return this.onboarding.create(dto, actor, idempotencyKey);
  }

  @Post(':runId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Annuler une arrivée planifiée dont les comptes ne sont pas encore créés' })
  async cancel(@Param('runId', ParseUUIDPipe) runId: string, @Actor() actor: ActorContext) {
    return this.workflows.toSummary(await this.workflows.cancelScheduled(runId, actor));
  }
}
