import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const DEPARTURE_REASONS = [
  'RESIGNATION',
  'END_OF_CONTRACT',
  'END_OF_INTERNSHIP',
  'DISMISSAL',
  'RETIREMENT',
  'MOBILITY',
  'OTHER',
] as const;
export type DepartureReason = (typeof DEPARTURE_REASONS)[number];

export const DEPARTURE_REASON_LABELS: Record<DepartureReason, string> = {
  RESIGNATION: 'Démission',
  END_OF_CONTRACT: 'Fin de contrat',
  END_OF_INTERNSHIP: 'Fin de stage',
  DISMISSAL: 'Licenciement',
  RETIREMENT: 'Départ à la retraite',
  MOBILITY: 'Mobilité externe',
  OTHER: 'Autre motif',
};

export class CreateOffboardingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ enum: DEPARTURE_REASONS })
  @IsIn(DEPARTURE_REASONS)
  reason: DepartureReason;

  @ApiPropertyOptional({ example: 'Dernier jour le 30/11, passation faite avec l’équipe.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Date et heure de révocation. Absente ou passée : révocation immédiate.',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Date de révocation invalide' })
  effectiveAt?: string;

  @ApiProperty({ description: 'Confirmation : recopier l’identifiant exact de l’employé' })
  @IsString()
  confirmUsername: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  notifyManager?: boolean;
}
