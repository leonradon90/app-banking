import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Account } from '../accounts/entities/account.entity';
import { AuditService } from '../audit/audit.service';
import { hasPrivilegedRole } from '../common/utils/roles';
import { EventsService } from '../events/events.service';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';

import { LimitRule, LimitScope } from './entities/limit-rule.entity';

@Injectable()
export class LimitsService {
  constructor(
    @InjectRepository(LimitRule)
    private readonly limitsRepository: Repository<LimitRule>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
  ) {}

  async evaluate(actor: string, dto: CreatePaymentDto) {
    const userId = this.extractUserId(actor);
    const rules = await this.limitsRepository
      .createQueryBuilder('rule')
      .where('rule.active = true')
      .andWhere(
        '(rule.account_id = :accountId OR rule.user_id = :userId OR (rule.account_id IS NULL AND rule.user_id IS NULL))',
        {
          accountId: dto.fromAccount,
          userId: userId ?? null,
        },
      )
      .getMany();

    const ledgerRepo = this.dataSource.getRepository(LedgerEntry);

    for (const rule of rules) {
      if (!rule.active) continue;

      let currentSpent = 0;
      const threshold = parseFloat(rule.threshold);
      let wouldExceed = false;

      if (rule.scope === LimitScope.PER_TRANSACTION) {
        wouldExceed = dto.amount > threshold;
        if (wouldExceed) {
          this.emitLimitAlert({
            ruleId: rule.id,
            scope: rule.scope,
            amount: dto.amount,
            threshold,
            currency: dto.currency,
            accountId: dto.fromAccount,
            userId,
          });
          await this.auditService.record(actor, 'LIMIT_REJECTED', {
            ruleId: rule.id,
            scope: rule.scope,
            amount: dto.amount,
            threshold,
          });
          throw new BadRequestException({
            code: 'LIMIT_EXCEEDED',
            message: `Transaction limit exceeded: requested ${dto.amount}, limit ${threshold} ${dto.currency}`,
          });
        }
      }

      if (rule.scope === LimitScope.DAILY) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const result = await ledgerRepo
          .createQueryBuilder('entry')
          .select('COALESCE(SUM(entry.amount::numeric), 0)', 'total')
          .where('entry.debit_account = :accountId', { accountId: dto.fromAccount })
          .andWhere('entry.currency = :currency', { currency: dto.currency })
          .andWhere('entry.created_at >= :startOfDay', { startOfDay })
          .getRawOne();

        currentSpent = parseFloat(result?.total || '0');
        wouldExceed = currentSpent + dto.amount > threshold;

        if (wouldExceed) {
          this.emitLimitAlert({
            ruleId: rule.id,
            scope: rule.scope,
            amount: dto.amount,
            currentSpent,
            threshold,
            remaining: threshold - currentSpent,
            currency: dto.currency,
            accountId: dto.fromAccount,
            userId,
          });
          await this.auditService.record(actor, 'LIMIT_REJECTED', {
            ruleId: rule.id,
            scope: rule.scope,
            amount: dto.amount,
            currentSpent,
            threshold,
            remaining: threshold - currentSpent,
          });
          throw new BadRequestException({
            code: 'LIMIT_EXCEEDED',
            message: `Daily limit exceeded: spent ${currentSpent.toFixed(2)}, requested ${dto.amount}, limit ${threshold} ${dto.currency}. Remaining: ${(threshold - currentSpent).toFixed(2)}`,
          });
        }
      }

      if (rule.scope === LimitScope.MONTHLY) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const result = await ledgerRepo
          .createQueryBuilder('entry')
          .select('COALESCE(SUM(entry.amount::numeric), 0)', 'total')
          .where('entry.debit_account = :accountId', { accountId: dto.fromAccount })
          .andWhere('entry.currency = :currency', { currency: dto.currency })
          .andWhere('entry.created_at >= :startOfMonth', { startOfMonth })
          .getRawOne();

        currentSpent = parseFloat(result?.total || '0');
        wouldExceed = currentSpent + dto.amount > threshold;

        if (wouldExceed) {
          this.emitLimitAlert({
            ruleId: rule.id,
            scope: rule.scope,
            amount: dto.amount,
            currentSpent,
            threshold,
            remaining: threshold - currentSpent,
            currency: dto.currency,
            accountId: dto.fromAccount,
            userId,
          });
          await this.auditService.record(actor, 'LIMIT_REJECTED', {
            ruleId: rule.id,
            scope: rule.scope,
            amount: dto.amount,
            currentSpent,
            threshold,
            remaining: threshold - currentSpent,
          });
          throw new BadRequestException({
            code: 'LIMIT_EXCEEDED',
            message: `Monthly limit exceeded: spent ${currentSpent.toFixed(2)}, requested ${dto.amount}, limit ${threshold} ${dto.currency}. Remaining: ${(threshold - currentSpent).toFixed(2)}`,
          });
        }
      }

      if (rule.mcc && dto.mcc && rule.mcc !== dto.mcc) {
        continue;
      }

      if (rule.geo && dto.geoLocation && rule.geo !== dto.geoLocation) {
        continue;
      }
    }

    await this.auditService.record(actor, 'LIMIT_EVALUATED', {
      amount: dto.amount,
      fromAccount: dto.fromAccount,
      toAccount: dto.toAccount,
      currency: dto.currency,
    });
  }

  async createRule(rule: Partial<LimitRule>, userId: number, actor: string, roles?: string[]) {
    const privileged = hasPrivilegedRole(roles);
    const targetUserId = privileged ? rule.userId : userId;
    const targetAccountId = rule.accountId
      ? await this.resolveAccountScope(rule.accountId, userId, roles)
      : undefined;

    if (!privileged && rule.userId !== undefined && rule.userId !== userId) {
      throw new ForbiddenException('You can only manage limits for your own profile');
    }

    const entity = this.limitsRepository.create({
      ...rule,
      userId: targetUserId,
      accountId: targetAccountId,
    });
    const saved = await this.limitsRepository.save(entity);
    await this.auditService.record(actor, 'LIMIT_RULE_CREATED', {
      ruleId: saved.id,
      scope: saved.scope,
      threshold: saved.threshold,
      userId: saved.userId,
      accountId: saved.accountId,
    });
    return saved;
  }

  async getRules(userId: number, roles?: string[]) {
    if (hasPrivilegedRole(roles)) {
      return this.limitsRepository.find();
    }

    const accountRepo = this.dataSource.getRepository(Account);
    const accounts = await accountRepo.find({
      where: { userId },
      select: ['id'],
    });
    const accountIds = accounts.map((account) => account.id);

    const queryBuilder = this.limitsRepository.createQueryBuilder('rule');
    queryBuilder.where('rule.user_id = :userId', { userId });
    if (accountIds.length > 0) {
      queryBuilder.orWhere('rule.account_id IN (:...accountIds)', { accountIds });
    }
    queryBuilder.orWhere('(rule.account_id IS NULL AND rule.user_id IS NULL)');
    queryBuilder.orderBy('rule.created_at', 'DESC');
    return queryBuilder.getMany();
  }

  private async resolveAccountScope(accountId: number, userId: number, roles?: string[]) {
    const accountRepo = this.dataSource.getRepository(Account);
    const account = await accountRepo.findOne({ where: { id: accountId } });
    if (!account) {
      throw new BadRequestException('Account not found');
    }
    if (account.userId !== userId && !hasPrivilegedRole(roles)) {
      throw new ForbiddenException('You can only manage limits for your own accounts');
    }
    return account.id;
  }

  private extractUserId(actor: string): number | undefined {
    if (!actor.startsWith('user_')) return undefined;
    const id = Number(actor.replace('user_', ''));
    return Number.isNaN(id) ? undefined : id;
  }

  private emitLimitAlert(payload: Record<string, unknown>) {
    this.eventsService.emit('fraud_alerts', {
      event: 'LIMIT_REJECTED',
      emittedAt: new Date().toISOString(),
      ...payload,
    });
  }
}
