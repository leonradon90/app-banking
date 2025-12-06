import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

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
    @Request() req: any,
  ) {
    const actor = req.user?.email || req.user?.id?.toString() || 'system';
    return this.ledgerService.recordTransfer(dto, actor);
  }

  @Get('account/:accountId')
  @ApiOperation({ summary: 'Получить историю транзакций для счета' })
  @ApiResponse({ status: 200, description: 'История транзакций' })
  async findByAccount(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.ledgerService.getHistory(accountId);
  }

  @Get('entry/:entryId')
  @ApiOperation({ summary: 'Получить запись по ID' })
  @ApiResponse({ status: 200, description: 'Запись найдена' })
  @ApiResponse({ status: 404, description: 'Запись не найдена' })
  async getEntry(@Param('entryId', ParseIntPipe) entryId: number) {
    return this.ledgerService.getEntryById(entryId);
  }

  @Get('account/:accountId/balance/verify')
  @ApiOperation({ summary: 'Проверить целостность баланса счета' })
  @ApiResponse({ status: 200, description: 'Результат проверки баланса' })
  async verifyBalance(@Param('accountId', ParseIntPipe) accountId: number) {
    return this.ledgerService.verifyAccountBalance(accountId);
  }
}
