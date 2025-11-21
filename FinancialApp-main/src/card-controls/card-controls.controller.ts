import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CardControlsService } from './card-controls.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

class RegisterCardDto {
  @IsNumber()
  accountId!: number;

  @IsString()
  cardToken!: string;
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
  constructor(private readonly cardControlsService: CardControlsService) {}

  @Post('register')
  register(@Body() dto: RegisterCardDto) {
    return this.cardControlsService.registerCard(dto.accountId, dto.cardToken);
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
