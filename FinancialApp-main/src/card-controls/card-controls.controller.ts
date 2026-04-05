import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, Length } from 'class-validator';

import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { CardControlsService } from './card-controls.service';
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

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.cardControlsService.listCards(user.userId, user.roles);
  }

  @Post('register')
  register(@Body() dto: RegisterCardDto, @CurrentUser() user: CurrentUserPayload) {
    return this.cardControlsService.registerCard(
      dto.accountId,
      dto.cardToken,
      user.userId,
      user.roles,
      dto.panLast4,
    );
  }

  @Post('tokenize')
  tokenize(@Body() dto: TokenizeCardDto, @CurrentUser() user: CurrentUserPayload) {
    const result = this.tokenizationService.tokenizePan(dto.pan);
    return this.cardControlsService.registerCard(
      dto.accountId,
      result.cardToken,
      user.userId,
      user.roles,
      result.panLast4,
      result.panEncrypted,
    );
  }

  @Post(':cardToken/freeze')
  freeze(
    @Param('cardToken') cardToken: string,
    @Body() dto: FreezeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.cardControlsService.freeze(
      cardToken,
      dto.reason ?? 'user_request',
      user.userId,
      user.roles,
    );
  }

  @Post(':cardToken/unfreeze')
  unfreeze(@Param('cardToken') cardToken: string, @CurrentUser() user: CurrentUserPayload) {
    return this.cardControlsService.unfreeze(cardToken, user.userId, user.roles);
  }

  @Patch(':cardToken/limits')
  updateLimits(
    @Param('cardToken') cardToken: string,
    @Body() dto: UpdateLimitsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.cardControlsService.updateLimits(cardToken, dto, user.userId, user.roles);
  }
}
