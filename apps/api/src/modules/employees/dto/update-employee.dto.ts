import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Lead développeur' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  jobTitle?: string;

  @ApiPropertyOptional({ example: 'Engineering' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  department?: string;

  @ApiPropertyOptional({ example: 'Antananarivo', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(80)
  location?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  managerName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_o, value) => value !== null)
  @IsEmail({}, { message: 'E-mail du manager invalide' })
  managerEmail?: string | null;
}
