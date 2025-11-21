import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { IsObject } from 'class-validator';

class UpdateNotificationsDto {
  @IsObject()
  channels!: Record<string, boolean>;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('preferences')
  update(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateNotificationsDto) {
    return this.notificationsService.upsertPreferences(user.userId, dto.channels);
  }

  @Get('preferences')
  get(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.getPreferences(user.userId);
  }
}
