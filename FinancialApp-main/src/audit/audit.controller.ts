import { Controller, Get, Query, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { hasPrivilegedRole } from '../common/utils/roles';

import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Получить логи аудита с фильтрацией и пагинацией' })
  @ApiResponse({ status: 200, description: 'Список логов аудита' })
  async getAuditLogs(@Query() query: QueryAuditLogDto, @CurrentUser() user: CurrentUserPayload) {
    return this.auditService.findLogs(query, {
      actor: `user_${user.userId}`,
      privileged: hasPrivilegedRole(user.roles),
    });
  }

  @Get('actor/:actor')
  @ApiOperation({ summary: 'Получить логи аудита по актору' })
  @ApiResponse({ status: 200, description: 'Логи аудита для указанного актора' })
  async getLogsByActor(
    @Param('actor') actor: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.auditService.findLogs(
      {
        actor,
        page: page || 1,
        limit: limit || 20,
      },
      {
        actor: `user_${user?.userId}`,
        privileged: hasPrivilegedRole(user?.roles),
      },
    );
  }

  @Get('action/:action')
  @ApiOperation({ summary: 'Получить логи аудита по действию' })
  @ApiResponse({ status: 200, description: 'Логи аудита для указанного действия' })
  async getLogsByAction(
    @Param('action') action: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.auditService.findLogs(
      {
        action,
        page: page || 1,
        limit: limit || 20,
      },
      {
        actor: `user_${user?.userId}`,
        privileged: hasPrivilegedRole(user?.roles),
      },
    );
  }

  @Get('trace/:traceId')
  @ApiOperation({ summary: 'Получить логи аудита по trace_id' })
  @ApiResponse({ status: 200, description: 'Логи аудита для указанного trace_id' })
  async getLogsByTraceId(
    @Param('traceId') traceId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.auditService.findLogsByTraceId(traceId, {
      actor: `user_${user.userId}`,
      privileged: hasPrivilegedRole(user.roles),
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Получить статистику по действиям' })
  @ApiResponse({ status: 200, description: 'Статистика по действиям' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.auditService.getActionStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      {
        actor: `user_${user?.userId}`,
        privileged: hasPrivilegedRole(user?.roles),
      },
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить лог аудита по ID' })
  @ApiResponse({ status: 200, description: 'Лог аудита найден' })
  @ApiResponse({ status: 404, description: 'Лог аудита не найден' })
  async getLogById(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserPayload) {
    return this.auditService.findById(id, {
      actor: `user_${user.userId}`,
      privileged: hasPrivilegedRole(user.roles),
    });
  }
}
