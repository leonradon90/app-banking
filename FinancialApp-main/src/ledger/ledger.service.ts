import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { Account, AccountStatus } from '../accounts/entities/account.entity';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async recordTransfer(dto: CreateLedgerEntryDto, actor: string): Promise<LedgerEntry> {
    if (!this.idempotencyService.validateIdempotencyKey(dto.idempotencyKey)) {
      throw new BadRequestException('Invalid idempotency key format');
    }

    return this.dataSource.transaction(async (manager) => {
      const idempotencyCheck = await this.idempotencyService.checkIdempotencyInTransaction(
        dto.idempotencyKey,
        manager,
      );

      if (idempotencyCheck.isDuplicate && idempotencyCheck.result) {
        return idempotencyCheck.result;
      }

      if (dto.debitAccountId === dto.creditAccountId) {
        throw new BadRequestException('Cannot transfer to the same account');
      }

      const accountRepo = manager.getRepository(Account);

      const debitAccount = await accountRepo.findOne({
        where: { id: dto.debitAccountId },
      });
      if (!debitAccount) {
        throw new NotFoundException(`Debit account ${dto.debitAccountId} not found`);
      }

      if (debitAccount.status !== AccountStatus.ACTIVE) {
        throw new BadRequestException(
          `Debit account ${dto.debitAccountId} is not active`,
        );
      }

      const creditAccount = await accountRepo.findOne({
        where: { id: dto.creditAccountId },
      });
      if (!creditAccount) {
        throw new NotFoundException(`Credit account ${dto.creditAccountId} not found`);
      }

      if (creditAccount.status !== AccountStatus.ACTIVE) {
        throw new BadRequestException(
          `Credit account ${dto.creditAccountId} is not active`,
        );
      }

      if (debitAccount.currency !== creditAccount.currency) {
        throw new BadRequestException(
          `Currency mismatch: debit account uses ${debitAccount.currency}, credit account uses ${creditAccount.currency}`,
        );
      }

      if (dto.currency !== debitAccount.currency) {
        throw new BadRequestException(
          `Currency mismatch: request currency ${dto.currency} does not match account currency ${debitAccount.currency}`,
        );
      }

      const debitBalance = parseFloat(debitAccount.balance);
      const amount = parseFloat(dto.amount.toFixed(2));

      if (debitBalance < amount) {
        throw new BadRequestException(
          `Insufficient funds: account ${dto.debitAccountId} has ${debitBalance}, required ${amount}`,
        );
      }

      const newDebitBalance = (debitBalance - amount).toFixed(2);
      const creditBalance = parseFloat(creditAccount.balance);
      const newCreditBalance = (creditBalance + amount).toFixed(2);

      const debitUpdateResult = await accountRepo.update(
        {
          id: dto.debitAccountId,
          version: debitAccount.version,
        },
        {
          balance: newDebitBalance,
          version: debitAccount.version + 1,
        },
      );

      if (debitUpdateResult.affected === 0) {
        throw new ConflictException(
          'Debit account was modified concurrently. Please retry.',
        );
      }

      const creditUpdateResult = await accountRepo.update(
        {
          id: dto.creditAccountId,
          version: creditAccount.version,
        },
        {
          balance: newCreditBalance,
          version: creditAccount.version + 1,
        },
      );

      if (creditUpdateResult.affected === 0) {
        throw new ConflictException(
          'Credit account was modified concurrently. Please retry.',
        );
      }

      const entry = manager.create(LedgerEntry, {
        debitAccountId: dto.debitAccountId,
        creditAccountId: dto.creditAccountId,
        amount: amount.toFixed(2),
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
        traceId: dto.traceId,
      });
      const savedEntry = await manager.save(entry);

      await this.auditService.record(
        actor,
        'LEDGER_TRANSFER',
        {
          entryId: savedEntry.id,
          debitAccountId: dto.debitAccountId,
          creditAccountId: dto.creditAccountId,
          amount: amount,
          currency: dto.currency,
          idempotencyKey: dto.idempotencyKey,
        },
        dto.traceId,
      );

      this.eventsService.emit('transactions', {
        type: 'TRANSACTION_SUCCESS',
        entryId: savedEntry.id,
        debitAccountId: dto.debitAccountId,
        creditAccountId: dto.creditAccountId,
        amount: amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
        traceId: dto.traceId,
      });

      return savedEntry;
    });
  }

  async getHistory(accountId: number): Promise<LedgerEntry[]> {
    return this.ledgerRepository.find({
      where: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
      order: { createdAt: 'DESC' },
      relations: ['debitAccount', 'creditAccount'],
    });
  }
  async getCalculatedBalance(accountId: number): Promise<number> {
    const result = await this.ledgerRepository
      .createQueryBuilder('entry')
      .select('SUM(CASE WHEN entry.creditAccountId = :accountId THEN entry.amount ELSE 0 END)', 'credits')
      .addSelect('SUM(CASE WHEN entry.debitAccountId = :accountId THEN entry.amount ELSE 0 END)', 'debits')
      .where('entry.debitAccountId = :accountId OR entry.creditAccountId = :accountId', { accountId })
      .getRawOne();

    const credits = parseFloat(result?.credits || '0');
    const debits = parseFloat(result?.debits || '0');
    return credits - debits;
  }

  async getEntryById(entryId: number): Promise<LedgerEntry> {
    const entry = await this.ledgerRepository.findOne({
      where: { id: entryId },
      relations: ['debitAccount', 'creditAccount'],
    });

    if (!entry) {
      throw new NotFoundException(`Ledger entry ${entryId} not found`);
    }

    return entry;
  }
  
  async verifyAccountBalance(accountId: number): Promise<{
    accountBalance: number;
    calculatedBalance: number;
    isConsistent: boolean;
  }> {
    const accountRepo = this.dataSource.getRepository(Account);
    const account = await accountRepo.findOne({ where: { id: accountId } });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const calculatedBalance = await this.getCalculatedBalance(accountId);
    const accountBalance = parseFloat(account.balance);

    return {
      accountBalance,
      calculatedBalance,
      isConsistent: Math.abs(accountBalance - calculatedBalance) < 0.01,
    };
  }
}
