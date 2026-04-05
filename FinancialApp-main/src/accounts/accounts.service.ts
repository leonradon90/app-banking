import { randomUUID } from 'crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { User } from '../auth/entities/user.entity';
import { hasPrivilegedRole } from '../common/utils/roles';
import { KycStatus } from '../kyc/kyc-status.enum';
import { LedgerService } from '../ledger/ledger.service';

import { CreateAccountDto } from './dto/create-account.dto';
import { Account, AccountStatus } from './entities/account.entity';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: number, dto: CreateAccountDto) {
    const initialBalance = dto.initialBalance ?? 0;
    const account = this.accountsRepository.create({
      userId,
      currency: dto.currency,
      status: AccountStatus.ACTIVE,
      balance: '0.00',
    });
    const savedAccount = await this.accountsRepository.save(account);

    await this.auditService.record(`user_${userId}`, 'ACCOUNT_CREATED', {
      accountId: savedAccount.id,
      currency: savedAccount.currency,
      initialBalance,
    });

    if (initialBalance > 0) {
      const systemAccount = await this.getOrCreateSystemAccount(dto.currency);
      await this.ledgerService.recordTransfer(
        {
          debitAccountId: systemAccount.id,
          creditAccountId: savedAccount.id,
          amount: initialBalance,
          currency: dto.currency,
          idempotencyKey: randomUUID(),
        },
        'system',
      );
      return this.findById(savedAccount.id);
    }

    return savedAccount;
  }

  async findById(id: number) {
    const account = await this.accountsRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async findAccessibleById(id: number, userId: number, roles?: string[]) {
    const account = await this.findById(id);
    if (account.userId !== userId && !hasPrivilegedRole(roles)) {
      throw new ForbiddenException('You do not have access to this account');
    }
    return account;
  }

  async findByUser(userId: number) {
    return this.accountsRepository.find({ where: { userId } });
  }

  async fundAccount(
    accountId: number,
    amount: number,
    actor: string,
    userId: number,
    roles?: string[],
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    const account = await this.findAccessibleById(accountId, userId, roles);
    const systemAccount = await this.getOrCreateSystemAccount(account.currency);
    const entry = await this.ledgerService.recordTransfer(
      {
        debitAccountId: systemAccount.id,
        creditAccountId: account.id,
        amount,
        currency: account.currency,
        idempotencyKey: randomUUID(),
      },
      actor,
    );
    await this.auditService.record(actor, 'ACCOUNT_FUNDED', {
      accountId,
      amount,
      currency: account.currency,
      ledgerEntryId: entry.id,
    });
    return entry;
  }

  private async getOrCreateSystemAccount(currency: string) {
    const systemUser = await this.getOrCreateSystemUser();
    let systemAccount = await this.accountsRepository.findOne({
      where: { userId: systemUser.id, currency },
    });

    if (!systemAccount) {
      systemAccount = this.accountsRepository.create({
        userId: systemUser.id,
        currency,
        status: AccountStatus.ACTIVE,
        balance: '1000000000.00',
      });
      systemAccount = await this.accountsRepository.save(systemAccount);
    }

    return systemAccount;
  }

  private async getOrCreateSystemUser() {
    const email = 'system@altx.finance';
    let user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(randomUUID(), 10);
      user = this.usersRepository.create({
        email,
        passwordHash,
        kycStatus: KycStatus.VERIFIED,
        roles: ['system'],
      });
      user = await this.usersRepository.save(user);
    }
    return user;
  }
}
