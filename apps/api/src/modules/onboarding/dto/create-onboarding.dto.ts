import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ContractType } from '../../../common/enums';
import { catalogValues } from '../../access-profiles/access-catalog';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}' -]*$/u;

export class OnboardingOptionsDto {
  @ApiPropertyOptional({ default: true, description: 'Envoyer l’e-mail de bienvenue à l’adresse personnelle' })
  @IsOptional()
  @IsBoolean()
  sendWelcomeEmail?: boolean = true;

  @ApiPropertyOptional({ default: true, description: 'Annoncer l’arrivée dans le canal #bienvenue' })
  @IsOptional()
  @IsBoolean()
  announceInChat?: boolean = true;

  @ApiPropertyOptional({ default: false, description: 'CDD ou stage : planifier la révocation des accès à la date de fin' })
  @IsOptional()
  @IsBoolean()
  scheduleDepartureAtEnd?: boolean = false;
}

export class OnboardingIdentityDto {
  @ApiProperty({ example: 'Hanitra' })
  @Transform(trim)
  @Length(2, 80)
  @Matches(NAME_PATTERN, { message: 'Le prénom contient des caractères non autorisés' })
  firstName: string;

  @ApiProperty({ example: 'Rakotomalala' })
  @Transform(trim)
  @Length(2, 80)
  @Matches(NAME_PATTERN, { message: 'Le nom contient des caractères non autorisés' })
  lastName: string;
}

export class PreviewOnboardingDto extends OnboardingIdentityDto {
  @ApiProperty({ format: 'uuid' })
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

export class CreateOnboardingDto extends PreviewOnboardingDto {
  @ApiProperty({ example: 'hanitra.rakoto@gmail.com', description: 'Adresse personnelle (e-mail de bienvenue)' })
  @Transform(lower)
  @IsEmail({}, { message: 'Adresse e-mail personnelle invalide' })
  @MaxLength(160)
  personalEmail: string;

  @ApiProperty({ example: 'Développeuse back-end' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  jobTitle: string;

  @ApiProperty({ example: 'Engineering' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  department: string;

  @ApiPropertyOptional({ example: 'Antananarivo' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  location?: string;

  @ApiProperty({ enum: ContractType, example: ContractType.CDI })
  @IsEnum(ContractType)
  contractType: ContractType;

  @ApiProperty({ example: '2026-12-01', description: 'Date d’arrivée (AAAA-MM-JJ)' })
  @IsDateString({ strict: true }, { message: 'Date d’arrivée invalide' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format attendu : AAAA-MM-JJ' })
  startDate: string;

  @ApiPropertyOptional({ example: '2027-05-31', description: 'Fin de contrat (CDD, stage)' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString({ strict: true }, { message: 'Date de fin invalide' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format attendu : AAAA-MM-JJ' })
  endDate?: string;

  @ApiPropertyOptional({ example: 'Toky Andrianina' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  managerName?: string;

  @ApiPropertyOptional({ example: 'toky.andrianina@tongapass.local' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Transform(lower)
  @IsEmail({}, { message: 'E-mail du manager invalide' })
  managerEmail?: string;

  @ApiPropertyOptional({ description: 'Obligatoire si des rôles supplémentaires sont demandés' })
  @ValidateIf((dto: CreateOnboardingDto) => (dto.extraRealmRoles?.length ?? 0) > 0)
  @Transform(trim)
  @IsString({ message: 'Justifiez les droits supplémentaires' })
  @MinLength(10, { message: 'La justification doit faire au moins 10 caractères' })
  @MaxLength(500)
  extraAccessJustification?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Création différée des comptes (ex. la veille de l’arrivée). Absente ou passée : création immédiate.',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Date de création des accès invalide' })
  provisionAt?: string;

  @ApiPropertyOptional({ type: OnboardingOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingOptionsDto)
  options?: OnboardingOptionsDto;
}
