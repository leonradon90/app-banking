import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LimitsService } from './limits.service';
import { CreateLimitDto } from './dto/create-limit.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('limits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('limits')
export class LimitsController {
  constructor(private readonly limitsService: LimitsService) {}

  @Post()
  create(@Body() dto: CreateLimitDto) {
    return this.limitsService.createRule({
      scope: dto.scope,
      threshold: dto.threshold.toFixed(2),
      accountId: dto.accountId,
      userId: dto.userId,
      active: dto.active ?? true,
    });
  }

  @Get()
  findAll() {
    return this.limitsService.getRules();
  }
}
