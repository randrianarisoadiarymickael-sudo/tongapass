import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { StepStatus } from '../../../common/enums';

export const AUTOMATION_EVENTS = ['run.started', 'step', 'run.finished'] as const;
export type AutomationEventKind = (typeof AUTOMATION_EVENTS)[number];

/** Événement envoyé par n8n (signé HMAC) pour faire avancer une exécution. */
export class AutomationEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  runId: string;

  @ApiProperty({ enum: AUTOMATION_EVENTS })
  @IsIn(AUTOMATION_EVENTS)
  event: AutomationEventKind;

  @ApiPropertyOptional({ example: 'keycloak.account' })
  @IsOptional()
  @Matches(/^[a-z]+\.[a-z_]+$/)
  step?: string;

  @ApiPropertyOptional({ enum: StepStatus })
  @IsOptional()
  @IsEnum(StepStatus)
  status?: StepStatus;

  @ApiPropertyOptional({ example: 'Compte créé (id 4f1c…)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '1842' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  executionId?: string;
}
