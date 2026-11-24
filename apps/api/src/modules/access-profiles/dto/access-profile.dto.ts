import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { catalogValues } from '../access-catalog';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAccessProfileDto {
  @ApiProperty({ example: 'data-analyst', description: 'Identifiant stable en kebab-case' })
  @Transform(trim)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Le code doit être en minuscules, chiffres et tirets' })
  @Length(2, 48)
  code: string;

  @ApiProperty({ example: 'Analyse de données' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiPropertyOptional({ example: 'Accès lecture au data warehouse' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '#3B57C2' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiProperty({ type: [String], example: ['employee', 'developer'] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsIn(catalogValues('realmRoles'), { each: true, message: 'Rôle hors catalogue : $value' })
  realmRoles: string[];

  @ApiProperty({ type: [String], example: ['Engineering'] })
  @IsArray()
  @ArrayUnique()
  @IsIn(catalogValues('groups'), { each: true, message: 'Groupe hors catalogue : $value' })
  groups: string[];

  @ApiProperty({ type: [String], example: ['developers'] })
  @IsArray()
  @ArrayUnique()
  @IsIn(catalogValues('giteaTeams'), { each: true, message: 'Équipe Gitea hors catalogue : $value' })
  giteaTeams: string[];

  @ApiProperty({ type: [String], example: ['town-square', 'engineering'] })
  @IsArray()
  @ArrayUnique()
  @IsIn(catalogValues('chatChannels'), { each: true, message: 'Canal hors catalogue : $value' })
  chatChannels: string[];
}

export class UpdateAccessProfileDto extends PartialType(OmitType(CreateAccessProfileDto, ['code'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
