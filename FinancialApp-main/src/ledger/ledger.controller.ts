import {
  BadRequestException,
  ForbiddenException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { hasPrivilegedRole } from '../common/utils/roles';

interface RequestWithUser {
  user?: {
    email?: string;
    id?: string | number;
  };
}

import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { LedgerService } from './ledger.service';

@ApiTags('ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('transfer')
  @ApiOperation({ summary: 'Создать перевод через главную книгу' })
  @ApiResponse({ status: 201, description: 'Перевод успешно создан' })
  @ApiResponse({ status: 400, description: 'Неверные параметры запроса' })
  @ApiResponse({ status: 409, description: 'Конфликт версий (нужно повторить запрос)' })
  async createTransfer(
    @Body() dto: CreateLedgerEntryDto,
    @Request() req: RequestWithUser,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
    @Headers('x-trace-id') traceIdHeader?: string,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    if (idempotencyKeyHeader && dto.idempotencyKey !== idempotencyKeyHeader) {
      throw new BadRequestException('Idempotency-Key header must match idempotencyKey in body');
    }
    if (!hasPrivilegedRole(user?.roles)) {
      throw new ForbiddenException(
        'Direct ledger transfers are restricted to privileged operators',
      );
    }
    const actor = req.user?.email || req.user?.id?.toString() || 'system';
    const traceId = traceIdHeader ?? dto.traceId ?? dto.idempotencyKey;
    return this.ledgerService.recordTransfer({ ...dto, traceId }, actor);
  }

  @Get('account/:accountId')
  @ApiOperation({ summary: 'Получить историю транзакций для счета' })
  @ApiResponse({ status: 200, description: 'История транзакций' })
  async findByAccount(
    @Param('accountId', ParseIntPipe) accountId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ledgerService.getHistoryForUser(accountId, user.userId, user.roles);
  }

  @Get(':accountId(\\d+)')
  @ApiOperation({ summary: 'Получить историю транзакций для счета (legacy path)' })
  @ApiResponse({ status: 200, description: 'История транзакций' })
  async findByAccountLegacy(
    @Param('accountId', ParseIntPipe) accountId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ledgerService.getHistoryForUser(accountId, user.userId, user.roles);
  }

  @Get('entry/:entryId')
  @ApiOperation({ summary: 'Получить запись по ID' })
  @ApiResponse({ status: 200, description: 'Запись найдена' })
  @ApiResponse({ status: 404, description: 'Запись не найдена' })
  async getEntry(
    @Param('entryId', ParseIntPipe) entryId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ledgerService.getEntryByIdForUser(entryId, user.userId, user.roles);
  }

  @Get('account/:accountId/balance/verify')
  @ApiOperation({ summary: 'Проверить целостность баланса счета' })
  @ApiResponse({ status: 200, description: 'Результат проверки баланса' })
  async verifyBalance(
    @Param('accountId', ParseIntPipe) accountId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ledgerService.verifyAccountBalanceForUser(accountId, user.userId, user.roles);
  }

  @Post('account/:accountId/reconcile')
  @ApiOperation({ summary: 'Реконсиляция баланса счета с проводками' })
  @ApiResponse({ status: 200, description: 'Результат реконсиляции' })
  async reconcileAccount(
    @Param('accountId', ParseIntPipe) accountId: number,
    @Request() req: RequestWithUser,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const actor = req.user?.email || req.user?.id?.toString() || 'system';
    return this.ledgerService.reconcileAccountBalanceForUser(
      accountId,
      actor,
      user.userId,
      user.roles,
    );
  }
}
