import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Получить логи аудита с фильтрацией и пагинацией' })
  @ApiResponse({ status: 200, description: 'Список логов аудита' })
  async getAuditLogs(@Query() query: QueryAuditLogDto) {
    return this.auditService.findLogs(query);
  }

  @Get('actor/:actor')
  @ApiOperation({ summary: 'Получить логи аудита по актору' })
  @ApiResponse({ status: 200, description: 'Логи аудита для указанного актора' })
  async getLogsByActor(
    @Param('actor') actor: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.findLogs({
      actor,
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get('action/:action')
  @ApiOperation({ summary: 'Получить логи аудита по действию' })
  @ApiResponse({ status: 200, description: 'Логи аудита для указанного действия' })
  async getLogsByAction(
    @Param('action') action: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.findLogs({
      action,
      page: page || 1,
      limit: limit || 20,
    });
  }

  @Get('trace/:traceId')
  @ApiOperation({ summary: 'Получить логи аудита по trace_id' })
  @ApiResponse({ status: 200, description: 'Логи аудита для указанного trace_id' })
  async getLogsByTraceId(@Param('traceId') traceId: string) {
    return this.auditService.findLogsByTraceId(traceId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Получить статистику по действиям' })
  @ApiResponse({ status: 200, description: 'Статистика по действиям' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getActionStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить лог аудита по ID' })
  @ApiResponse({ status: 200, description: 'Лог аудита найден' })
  @ApiResponse({ status: 404, description: 'Лог аудита не найден' })
  async getLogById(@Param('id', ParseIntPipe) id: number) {
    return this.auditService.findById(id);
  }
}

