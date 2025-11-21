import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LimitRule, LimitScope } from './entities/limit-rule.entity';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LimitsService {
  constructor(
    @InjectRepository(LimitRule)
    private readonly limitsRepository: Repository<LimitRule>,
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

    const failingRule = rules.find((rule) => {
      if (!rule.active) return false;
      if (rule.scope === LimitScope.PER_TRANSACTION) {
        return dto.amount > parseFloat(rule.threshold);
      }
      return false;
    });

    if (failingRule) {
      await this.auditService.record(actor, 'LIMIT_REJECTED', {
        ruleId: failingRule.id,
        amount: dto.amount,
      });
      throw new BadRequestException('Limit exceeded');
    }

    await this.auditService.record(actor, 'LIMIT_EVALUATED', {
      amount: dto.amount,
      fromAccount: dto.fromAccount,
      toAccount: dto.toAccount,
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
