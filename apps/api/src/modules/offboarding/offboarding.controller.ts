import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { CreateOffboardingDto } from './dto/create-offboarding.dto';
import { OffboardingService } from './offboarding.service';

@ApiTags('Départs')
@ApiBearerAuth()
@Roles(AppRole.HR)
@Controller('offboarding')
export class OffboardingController {
  constructor(private readonly offboarding: OffboardingService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Déclarer un départ : révocation immédiate ou planifiée de tous les accès',
    description:
      'Désactive le compte Keycloak, révoque les sessions, retire rôles et groupes, bloque Gitea et Mattermost, ' +
      'puis notifie le manager. La confirmation par identifiant protège contre les erreurs de manipulation.',
  })
  @ApiAcceptedResponse({ description: 'Départ enregistré (en cours ou planifié)' })
  create(@Body() dto: CreateOffboardingDto, @Actor() actor: ActorContext) {
    return this.offboarding.create(dto, actor);
  }

  @Post(':runId/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Annuler un départ planifié qui n’a pas encore commencé' })
  cancel(@Param('runId', ParseUUIDPipe) runId: string, @Actor() actor: ActorContext) {
    return this.offboarding.cancel(runId, actor);
  }
}
