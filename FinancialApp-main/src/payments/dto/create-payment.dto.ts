import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

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
  @IsOptional()
  description?: string;

  @ApiProperty({
    required: false,
    description: 'Card token for card transactions',
  })
  @IsString()
  @IsOptional()
  cardToken?: string;

  @ApiProperty({
    required: false,
    description: 'MCC (Merchant Category Code) for card transactions',
  })
  @IsNumber()
  @Min(0)
  @Max(9999)
  @IsOptional()
  mcc?: number;

  @ApiProperty({
    required: false,
    description: 'Geolocation code (ISO country code) for card transactions',
    example: 'US',
  })
  @IsString()
  @Length(2, 3)
  @IsOptional()
  geoLocation?: string;
}
