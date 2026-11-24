import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { catalogValues } from '../../access-profiles/access-catalog';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class MobilityPreviewDto {
  @ApiProperty({ format: 'uuid', description: 'Nouveau profil d’accès' })
  @IsUUID()
  accessProfileId: string;

  @ApiPropertyOptional({ type: [String], example: ['devops'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(5)
  @IsIn(catalogValues('realmRoles'), { each: true, message: 'Rôle hors catalogue : $value' })
  extraRealmRoles?: string[];
}

export class CreateMobilityDto extends MobilityPreviewDto {
  @ApiPropertyOptional({ example: 'Lead développeuse' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'Engineering' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  department?: string;

  @ApiPropertyOptional({ description: 'Obligatoire si des rôles supplémentaires sont demandés' })
  @ValidateIf((dto: CreateMobilityDto) => (dto.extraRealmRoles?.length ?? 0) > 0)
  @Transform(trim)
  @IsString({ message: 'Justifiez les droits supplémentaires' })
  @MinLength(10, { message: 'La justification doit faire au moins 10 caractères' })
  @MaxLength(500)
  extraAccessJustification?: string;

  @ApiPropertyOptional({ example: 'Promotion au sein de l’équipe plateforme' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Date d’effet. Absente ou passée : immédiat.' })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Date d’effet invalide' })
  effectiveAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  notifyManager?: boolean;
}
