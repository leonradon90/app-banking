import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { CreateLimitDto } from './dto/create-limit.dto';
import { LimitsService } from './limits.service';

@ApiTags('limits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('limits')
export class LimitsController {
  constructor(private readonly limitsService: LimitsService) {}

  @Post()
  create(@Body() dto: CreateLimitDto, @CurrentUser() user: CurrentUserPayload) {
    return this.limitsService.createRule(
      {
        scope: dto.scope,
        threshold: dto.threshold.toFixed(2),
        accountId: dto.accountId,
        userId: dto.userId,
        active: dto.active ?? true,
      },
      user.userId,
      `user_${user.userId}`,
      user.roles,
    );
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.limitsService.getRules(user.userId, user.roles);
  }
}
