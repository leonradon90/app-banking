import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, IsUUID, Length } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty()
  @IsNumber()
  fromAccount!: number;

  @ApiProperty()
  @IsNumber()
  toAccount!: number;

  @ApiProperty()
  @IsPositive()
  amount!: number;

  @ApiProperty({ default: 'USD' })
  @Length(3, 3)
  currency!: string;

  @ApiProperty()
  @IsUUID()
  idempotencyKey!: string;

  @ApiProperty({ required: false })
  @IsString()
  description?: string;
}
