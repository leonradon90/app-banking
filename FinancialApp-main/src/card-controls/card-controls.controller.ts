import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CardControlsService } from './card-controls.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsArray, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { TokenizationService } from './tokenization.service';

class RegisterCardDto {
  @IsNumber()
  accountId!: number;

  @IsString()
  cardToken!: string;

  @IsOptional()
  @IsString()
  @Length(4, 4)
  panLast4?: string;
}

class TokenizeCardDto {
  @IsNumber()
  accountId!: number;

  @IsString()
  pan!: string;
}

class FreezeDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class UpdateLimitsDto {
  @IsOptional()
  @IsArray()
  mccWhitelist?: number[];

  @IsOptional()
  @IsArray()
  geoWhitelist?: string[];

  @IsOptional()
  spendLimits?: Record<string, unknown>;
}

@ApiTags('card-controls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('card-controls')
export class CardControlsController {
  constructor(
    private readonly cardControlsService: CardControlsService,
    private readonly tokenizationService: TokenizationService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterCardDto) {
    return this.cardControlsService.registerCard(dto.accountId, dto.cardToken, dto.panLast4);
  }

  @Post('tokenize')
  tokenize(@Body() dto: TokenizeCardDto) {
    const result = this.tokenizationService.tokenizePan(dto.pan);
    return this.cardControlsService.registerCard(
      dto.accountId,
      result.cardToken,
      result.panLast4,
      result.panEncrypted,
    );
  }

  @Post(':cardToken/freeze')
  freeze(@Param('cardToken') cardToken: string, @Body() dto: FreezeDto) {
    return this.cardControlsService.freeze(cardToken, dto.reason ?? 'user_request');
  }

  @Post(':cardToken/unfreeze')
  unfreeze(@Param('cardToken') cardToken: string) {
    return this.cardControlsService.unfreeze(cardToken);
  }

  @Patch(':cardToken/limits')
  updateLimits(@Param('cardToken') cardToken: string, @Body() dto: UpdateLimitsDto) {
    return this.cardControlsService.updateLimits(cardToken, dto);
  }
}
