import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { CreateMobilityDto, MobilityPreviewDto } from './dto/mobility.dto';
import { MobilityService } from './mobility.service';

@ApiTags('Mobilités')
@ApiBearerAuth()
@Roles(AppRole.HR)
@Controller('employees/:id/mobility')
export class MobilityController {
  constructor(private readonly mobility: MobilityService) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Prévisualiser l’écart de droits (ajouts, retraits) avant une mobilité' })
  preview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MobilityPreviewDto) {
    return this.mobility.preview(id, dto);
  }

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Changer de poste ou de profil d’accès (immédiat ou planifié)',
    description: 'n8n ajoute les nouveaux droits et retire ceux qui ne sont plus nécessaires dans Keycloak, Gitea et Mattermost.',
  })
  @ApiAcceptedResponse({ description: 'Mobilité enregistrée, ajustement des droits en cours ou planifié' })
  create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMobilityDto, @Actor() actor: ActorContext) {
    return this.mobility.create(id, dto, actor);
  }
}
