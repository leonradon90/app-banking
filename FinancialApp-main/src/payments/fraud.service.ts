import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../events/events.service';

export interface FraudCheckResult {
  passed: boolean;
  reason?: string;
  riskScore: number;
}

@Injectable()
export class FraudService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly eventsService: EventsService,
  ) {}

  async validatePayment(
    actor: string,
    dto: CreatePaymentDto,
    accountId: number,
    traceId?: string,
  ): Promise<FraudCheckResult> {
    let riskScore = 0;
    const reasons: string[] = [];

    const velocityCheck = await this.checkTransactionVelocity(accountId);
    if (!velocityCheck.passed) {
      riskScore += velocityCheck.riskScore;
      reasons.push(velocityCheck.reason || 'High transaction frequency');
    }

    const amountCheck = await this.checkTransactionAmount(
      accountId,
      dto.amount,
      dto.currency,
    );
    if (!amountCheck.passed) {
      riskScore += amountCheck.riskScore;
      reasons.push(amountCheck.reason || 'Suspicious transaction amount');
    }

    const patternCheck = await this.checkTransactionPattern(
      accountId,
      dto.toAccount,
      dto.amount,
    );
    if (!patternCheck.passed) {
      riskScore += patternCheck.riskScore;
      reasons.push(patternCheck.reason || 'Suspicious transaction pattern');
    }

    const roundAmountCheck = this.checkRoundAmount(dto.amount);
    if (!roundAmountCheck.passed) {
      riskScore += roundAmountCheck.riskScore;
      reasons.push(roundAmountCheck.reason || 'Suspicious amount');
    }

    const passed = riskScore < 70;

    await this.auditService.record(
      actor,
      passed ? 'FRAUD_CHECK_PASSED' : 'FRAUD_CHECK_FAILED',
      {
        accountId,
        amount: dto.amount,
        currency: dto.currency,
        riskScore,
        reasons: reasons.length > 0 ? reasons : undefined,
      },
      traceId,
    );

    if (!passed) {
      this.eventsService.emit('fraud_alerts', {
        type: 'FRAUD_ALERT',
        actor,
        accountId,
        amount: dto.amount,
        currency: dto.currency,
        riskScore,
        reasons: reasons.length > 0 ? reasons : undefined,
        traceId,
        createdAt: new Date().toISOString(),
      });
      throw new BadRequestException({
        code: 'FRAUD_ALERT',
        message: `Transaction rejected due to high fraud risk. Risk score: ${riskScore}%. Reasons: ${reasons.join(', ')}`,
      });
    }

    return {
      passed: true,
      riskScore,
    };
  }

  private async checkTransactionVelocity(
    accountId: number,
  ): Promise<FraudCheckResult> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let riskScore = 0;
    let reason: string | undefined;

    const fiveMinCount = await this.ledgerRepository
      .createQueryBuilder('entry')
      .where('entry.debit_account = :accountId', { accountId })
      .andWhere('entry.created_at >= :fiveMinutesAgo', { fiveMinutesAgo })
      .getCount();

    const oneHourCount = await this.ledgerRepository
      .createQueryBuilder('entry')
      .where('entry.debit_account = :accountId', { accountId })
      .andWhere('entry.created_at >= :oneHourAgo', { oneHourAgo })
      .getCount();

    if (fiveMinCount >= 5) {
      riskScore += 50;
      reason = `Too many transactions in the last 5 minutes: ${fiveMinCount}`;
    } else if (fiveMinCount >= 3) {
      riskScore += 20;
    }

    if (oneHourCount >= 20) {
      riskScore += 40;
      reason = `Too many transactions in the last hour: ${oneHourCount}`;
    } else if (oneHourCount >= 10) {
      riskScore += 15;
    }

    return {
      passed: riskScore < 50,
      reason,
      riskScore,
    };
  }

  private async checkTransactionAmount(
    accountId: number,
    amount: number,
    currency: string,
  ): Promise<FraudCheckResult> {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const avgAmountResult = await this.ledgerRepository
      .createQueryBuilder('entry')
      .select('AVG(entry.amount::numeric)', 'avgAmount')
      .addSelect('MAX(entry.amount::numeric)', 'maxAmount')
      .where('entry.debit_account = :accountId', { accountId })
      .andWhere('entry.currency = :currency', { currency })
      .andWhere('entry.created_at >= :last30Days', { last30Days })
      .getRawOne();

    const avgAmount = parseFloat(avgAmountResult?.avgAmount || '0');
    const maxAmount = parseFloat(avgAmountResult?.maxAmount || '0');

    let riskScore = 0;
    let reason: string | undefined;

    if (avgAmount > 0 && amount > avgAmount * 10) {
      riskScore += 40;
      reason = `Transaction amount exceeds average by 10x (average: ${avgAmount.toFixed(2)}, current: ${amount})`;
    } else if (avgAmount > 0 && amount > avgAmount * 5) {
      riskScore += 20;
    }

    if (maxAmount > 0 && amount > maxAmount * 2) {
      riskScore += 30;
      reason = `Transaction amount exceeds historical maximum by 2x (max: ${maxAmount.toFixed(2)}, current: ${amount})`;
    }

    return {
      passed: riskScore < 50,
      reason,
      riskScore,
    };
  }

  private async checkTransactionPattern(
    accountId: number,
    toAccountId: number,
    amount: number,
  ): Promise<FraudCheckResult> {
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const similarTransactions = await this.ledgerRepository
      .createQueryBuilder('entry')
      .where('entry.debit_account = :accountId', { accountId })
      .andWhere('entry.credit_account = :toAccountId', { toAccountId })
      .andWhere('entry.amount::numeric = :amount', { amount: amount.toFixed(2) })
      .andWhere('entry.created_at >= :last24Hours', { last24Hours })
      .getCount();

    let riskScore = 0;
    let reason: string | undefined;

    if (similarTransactions >= 5) {
      riskScore += 50;
      reason = `Found ${similarTransactions} similar transactions in the last 24 hours`;
    } else if (similarTransactions >= 3) {
      riskScore += 25;
    }

    return {
      passed: riskScore < 50,
      reason,
      riskScore,
    };
  }

  private checkRoundAmount(amount: number): FraudCheckResult {
    const rounded = Math.round(amount);
    const isRound = amount === rounded;

    const veryRoundAmounts = [100, 500, 1000, 5000, 10000, 50000, 100000];
    const isVeryRound = veryRoundAmounts.includes(rounded);

    let riskScore = 0;
    let reason: string | undefined;

    if (isVeryRound && amount >= 1000) {
      riskScore += 15;
      reason = `Suspicious round amount detected: ${amount}`;
    } else if (isRound && amount >= 10000) {
      riskScore += 10;
    }

    return {
      passed: riskScore < 30,
      reason,
      riskScore,
    };
  }
}
