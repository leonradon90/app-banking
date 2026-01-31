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
import { User } from '../auth/entities/user.entity';
import { KycStatus } from '../kyc/kyc-status.enum';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { signPayload } from '../common/utils/hmac';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
    private readonly idempotencyService: IdempotencyService,
    private readonly configService: ConfigService,
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

      const eventPayload = {
        type: 'TRANSACTION_SUCCESS',
        entryId: savedEntry.id,
        debitAccountId: dto.debitAccountId,
        creditAccountId: dto.creditAccountId,
        amount: amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
        traceId: dto.traceId,
      } as Record<string, unknown>;

      this.attachLedgerSignature(eventPayload);
      this.eventsService.emit('transactions', eventPayload);

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

  async reconcileAccountBalance(accountId: number, actor: string) {
    return this.dataSource.transaction(async (manager) => {
      const accountRepo = manager.getRepository(Account);
      const ledgerRepo = manager.getRepository(LedgerEntry);
      const userRepo = manager.getRepository(User);

      const account = await accountRepo.findOne({ where: { id: accountId } });
      if (!account) {
        throw new NotFoundException(`Account ${accountId} not found`);
      }

      const calculatedBalance = await ledgerRepo
        .createQueryBuilder('entry')
        .select(
          'SUM(CASE WHEN entry.creditAccountId = :accountId THEN entry.amount ELSE 0 END)',
          'credits',
        )
        .addSelect(
          'SUM(CASE WHEN entry.debitAccountId = :accountId THEN entry.amount ELSE 0 END)',
          'debits',
        )
        .where('entry.debitAccountId = :accountId OR entry.creditAccountId = :accountId', { accountId })
        .getRawOne();

      const credits = parseFloat(calculatedBalance?.credits || '0');
      const debits = parseFloat(calculatedBalance?.debits || '0');
      const ledgerTotal = credits - debits;
      const accountBalance = parseFloat(account.balance);
      const difference = parseFloat((accountBalance - ledgerTotal).toFixed(2));

      if (Math.abs(difference) < 0.01) {
        return {
          status: 'consistent',
          accountBalance,
          calculatedBalance: ledgerTotal,
          isConsistent: true,
        };
      }

      let systemUser = await userRepo.findOne({ where: { email: 'system@altx.finance' } });
      if (!systemUser) {
        const passwordHash = await bcrypt.hash(randomUUID(), 10);
        systemUser = userRepo.create({
          email: 'system@altx.finance',
          passwordHash,
          kycStatus: KycStatus.VERIFIED,
          roles: ['system'],
        });
        systemUser = await userRepo.save(systemUser);
      }

      let systemAccount = await accountRepo.findOne({
        where: { userId: systemUser.id, currency: account.currency },
      });
      if (!systemAccount) {
        systemAccount = accountRepo.create({
          userId: systemUser.id,
          currency: account.currency,
          status: AccountStatus.ACTIVE,
          balance: '1000000000.00',
        });
        systemAccount = await accountRepo.save(systemAccount);
      }

      const resetResult = await accountRepo.update(
        { id: account.id, version: account.version },
        { balance: ledgerTotal.toFixed(2), version: account.version + 1 },
      );
      if (resetResult.affected === 0) {
        throw new ConflictException('Account was modified concurrently. Please retry.');
      }

      const debitAccountId = difference > 0 ? systemAccount.id : account.id;
      const creditAccountId = difference > 0 ? account.id : systemAccount.id;
      const debitAccount = await accountRepo.findOne({ where: { id: debitAccountId } });
      const creditAccount = await accountRepo.findOne({ where: { id: creditAccountId } });

      if (!debitAccount || !creditAccount) {
        throw new NotFoundException('Reconciliation accounts not found');
      }
      const amount = Math.abs(difference);

      const debitBalance = parseFloat(debitAccount.balance);
      if (debitBalance < amount) {
        throw new BadRequestException('System account has insufficient funds for reconciliation');
      }

      const debitUpdateResult = await accountRepo.update(
        { id: debitAccount.id, version: debitAccount.version },
        { balance: (debitBalance - amount).toFixed(2), version: debitAccount.version + 1 },
      );
      if (debitUpdateResult.affected === 0) {
        throw new ConflictException('Debit account was modified concurrently. Please retry.');
      }

      const creditBalance = parseFloat(creditAccount.balance);
      const creditUpdateResult = await accountRepo.update(
        { id: creditAccount.id, version: creditAccount.version },
        { balance: (creditBalance + amount).toFixed(2), version: creditAccount.version + 1 },
      );
      if (creditUpdateResult.affected === 0) {
        throw new ConflictException('Credit account was modified concurrently. Please retry.');
      }

      const entry = manager.create(LedgerEntry, {
        debitAccountId: debitAccount.id,
        creditAccountId: creditAccount.id,
        amount: amount.toFixed(2),
        currency: account.currency,
        idempotencyKey: randomUUID(),
        traceId: 'reconcile',
      });
      const savedEntry = await manager.save(entry);

      await this.auditService.record(actor, 'LEDGER_RECONCILED', {
        accountId: account.id,
        difference,
        entryId: savedEntry.id,
      });

      const eventPayload = {
        type: 'LEDGER_RECONCILED',
        accountId: account.id,
        difference,
        entryId: savedEntry.id,
      } as Record<string, unknown>;

      this.attachLedgerSignature(eventPayload);
      this.eventsService.emit('transactions', eventPayload);

      return {
        status: 'reconciled',
        accountBalance: accountBalance,
        calculatedBalance: ledgerTotal + difference,
        isConsistent: true,
        entryId: savedEntry.id,
      };
    });
  }

  private attachLedgerSignature(payload: Record<string, unknown>) {
    const enabled =
      this.configService.get<boolean>('ledger.eventSigningEnabled') ?? false;
    const secret = this.configService.get<string>('ledger.eventSigningSecret') ?? '';
    if (!enabled || !secret) return;
    payload.signatureAlg = 'sha256';
    payload.signature = signPayload(payload, secret);
  }
}
