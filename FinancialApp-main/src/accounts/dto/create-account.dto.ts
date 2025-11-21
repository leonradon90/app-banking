import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, Length, Min } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ default: 'USD', description: 'ISO currency code' })
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Min(0)
  initialBalance?: number;
}
