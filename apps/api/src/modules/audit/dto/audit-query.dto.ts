import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ActorType } from '../../../common/enums';

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Préfixe d’action, ex. « access. » ou « offboarding.completed »' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @ApiPropertyOptional({ enum: ActorType })
  @IsOptional()
  @IsEnum(ActorType)
  actorType?: ActorType;

  @ApiPropertyOptional({ description: 'Identifiant de la cible (ex. UUID employé)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetId?: string;

  @ApiPropertyOptional({ description: 'Recherche plein texte (résumé, acteur, cible)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
