import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { RunStatus, RunType } from '../../../common/enums';

const toArray = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value;

export class RunQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RunType })
  @IsOptional()
  @IsEnum(RunType)
  type?: RunType;

  @ApiPropertyOptional({ description: 'Statuts séparés par des virgules', example: 'RUNNING,FAILED' })
  @IsOptional()
  @Transform(toArray)
  @IsEnum(RunStatus, { each: true })
  status?: RunStatus[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
