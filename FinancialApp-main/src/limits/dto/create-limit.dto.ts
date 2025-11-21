import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { LimitScope } from '../entities/limit-rule.entity';

export class CreateLimitDto {
  @ApiProperty({ enum: LimitScope })
  @IsEnum(LimitScope)
  scope!: LimitScope;

  @ApiProperty()
  @IsNumber()
  threshold!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  accountId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
