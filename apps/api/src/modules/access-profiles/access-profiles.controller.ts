import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums';
import type { ActorContext } from '../../common/types';
import { AccessProfilesService } from './access-profiles.service';
import { CreateAccessProfileDto, UpdateAccessProfileDto } from './dto/access-profile.dto';

@ApiTags('Profils d’accès')
@ApiBearerAuth()
@Controller('access-profiles')
export class AccessProfilesController {
  constructor(private readonly service: AccessProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les profils d’accès (modèles de droits par poste)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  list(@Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive?: boolean) {
    return this.service.list(includeInactive ?? false);
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Catalogue fermé des rôles, groupes, équipes et canaux attribuables' })
  catalog() {
    return this.service.catalog();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un profil d’accès' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @Roles(AppRole.ADMIN)
  @ApiOperation({ summary: 'Créer un profil d’accès (administrateur IAM)' })
  create(@Body() dto: CreateAccessProfileDto, @Actor() actor: ActorContext) {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @Roles(AppRole.ADMIN)
  @ApiOperation({ summary: 'Modifier un profil d’accès (administrateur IAM)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccessProfileDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(AppRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un profil inutilisé (administrateur IAM)' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string, @Actor() actor: ActorContext) {
    return this.service.remove(id, actor);
  }
}
