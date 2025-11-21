import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { Account } from '../accounts/entities/account.entity';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
  ) {}

  async recordTransfer(dto: CreateLedgerEntryDto, actor: string) {
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(LedgerEntry, {
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return existing;
      }

      if (dto.debitAccountId === dto.creditAccountId) {
        throw new BadRequestException('Cannot transfer to the same account');
      }

      const accountRepo = manager.getRepository(Account);
      const debitAccount = await accountRepo.findOne({
        where: { id: dto.debitAccountId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!debitAccount) {
        throw new NotFoundException('Debit account not found');
      }

      const creditAccount = await accountRepo.findOne({
        where: { id: dto.creditAccountId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!creditAccount) {
        throw new NotFoundException('Credit account not found');
      }

      if (debitAccount.currency !== creditAccount.currency) {
        throw new BadRequestException('Currency mismatch');
      }

      const debitBalance = parseFloat(debitAccount.balance);
      if (debitBalance < dto.amount) {
        throw new BadRequestException('Insufficient funds');
      }

      const newDebitBalance = (debitBalance - dto.amount).toFixed(2);
      const creditBalance = parseFloat(creditAccount.balance);
      const newCreditBalance = (creditBalance + dto.amount).toFixed(2);

      await accountRepo.update({ id: dto.debitAccountId }, { balance: newDebitBalance });
      await accountRepo.update({ id: dto.creditAccountId }, { balance: newCreditBalance });

      const entry = manager.create(LedgerEntry, {
        debitAccountId: dto.debitAccountId,
        creditAccountId: dto.creditAccountId,
        amount: dto.amount.toFixed(2),
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
        traceId: dto.traceId,
      });
      const savedEntry = await manager.save(entry);

      await this.auditService.record(actor, 'LEDGER_TRANSFER', {
        debitAccountId: dto.debitAccountId,
        creditAccountId: dto.creditAccountId,
        amount: dto.amount,
        currency: dto.currency,
      });

      this.eventsService.emit('transactions', {
        type: 'TRANSACTION_SUCCESS',
        entryId: savedEntry.id,
        ...dto,
      });

      return savedEntry;
    });
  }

  async getHistory(accountId: number) {
    return this.ledgerRepository.find({
      where: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
      order: { createdAt: 'DESC' },
    });
  }
}
