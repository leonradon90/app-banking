import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, IsUUID, Length } from 'class-validator';

export class CreateLedgerEntryDto {
  @ApiProperty()
  @IsNumber()
  debitAccountId!: number;

  @ApiProperty()
  @IsNumber()
  creditAccountId!: number;

  @ApiProperty()
  @IsPositive()
  amount!: number;

  @ApiProperty({ default: 'USD' })
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ description: 'Idempotency key per client request' })
  @IsUUID()
  idempotencyKey!: string;

  @ApiProperty({ required: false })
  @IsString()
  traceId?: string;
}
