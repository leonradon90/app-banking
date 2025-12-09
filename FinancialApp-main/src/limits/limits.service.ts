import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LimitRule, LimitScope } from './entities/limit-rule.entity';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { AuditService } from '../audit/audit.service';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';

@Injectable()
export class LimitsService {
  constructor(
    @InjectRepository(LimitRule)
    private readonly limitsRepository: Repository<LimitRule>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
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
      let threshold = parseFloat(rule.threshold);
      let wouldExceed = false;

      if (rule.scope === LimitScope.PER_TRANSACTION) {
        wouldExceed = dto.amount > threshold;
        if (wouldExceed) {
          await this.auditService.record(actor, 'LIMIT_REJECTED', {
            ruleId: rule.id,
            scope: rule.scope,
            amount: dto.amount,
            threshold,
          });
          throw new BadRequestException(
            `Transaction limit exceeded: requested ${dto.amount}, limit ${threshold} ${dto.currency}`,
          );
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
          await this.auditService.record(actor, 'LIMIT_REJECTED', {
            ruleId: rule.id,
            scope: rule.scope,
            amount: dto.amount,
            currentSpent,
            threshold,
            remaining: threshold - currentSpent,
          });
          throw new BadRequestException(
            `Daily limit exceeded: spent ${currentSpent.toFixed(2)}, requested ${dto.amount}, limit ${threshold} ${dto.currency}. Remaining: ${(threshold - currentSpent).toFixed(2)}`,
          );
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
          await this.auditService.record(actor, 'LIMIT_REJECTED', {
            ruleId: rule.id,
            scope: rule.scope,
            amount: dto.amount,
            currentSpent,
            threshold,
            remaining: threshold - currentSpent,
          });
          throw new BadRequestException(
            `Monthly limit exceeded: spent ${currentSpent.toFixed(2)}, requested ${dto.amount}, limit ${threshold} ${dto.currency}. Remaining: ${(threshold - currentSpent).toFixed(2)}`,
          );
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

  async createRule(rule: Partial<LimitRule>) {
    const entity = this.limitsRepository.create(rule);
    return this.limitsRepository.save(entity);
  }

  async getRules() {
    return this.limitsRepository.find();
  }

  private extractUserId(actor: string): number | undefined {
    if (!actor.startsWith('user_')) return undefined;
    const id = Number(actor.replace('user_', ''));
    return Number.isNaN(id) ? undefined : id;
  }
}
