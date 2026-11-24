import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { EmployeeStatus } from '../../../common/enums';

const toArray = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean) : value;

export const EMPLOYEE_SORTS = ['startDate', 'lastName', 'createdAt'] as const;

export class EmployeeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Nom, prénom, identifiant, e-mail ou matricule' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ description: 'Statuts séparés par des virgules', example: 'ACTIVE,PROVISIONING' })
  @IsOptional()
  @Transform(toArray)
  @IsEnum(EmployeeStatus, { each: true })
  status?: EmployeeStatus[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accessProfileId?: string;

  @ApiPropertyOptional({ enum: EMPLOYEE_SORTS, default: 'createdAt' })
  @IsOptional()
  @IsIn(EMPLOYEE_SORTS)
  sort: (typeof EMPLOYEE_SORTS)[number] = 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order: 'ASC' | 'DESC' = 'DESC';
}
