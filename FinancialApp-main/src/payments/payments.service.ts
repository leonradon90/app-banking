import { Injectable } from '@nestjs/common';
import { LedgerService } from '../ledger/ledger.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { LimitsService } from '../limits/limits.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly limitsService: LimitsService,
    private readonly auditService: AuditService,
  ) {}

  async createPayment(dto: CreatePaymentDto, actor: string) {
    await this.limitsService.evaluate(actor, dto);
    const ledgerEntry = await this.ledgerService.recordTransfer(
      {
        debitAccountId: dto.fromAccount,
        creditAccountId: dto.toAccount,
        amount: dto.amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
      },
      actor,
    );

    await this.auditService.record(actor, 'PAYMENT', {
      fromAccount: dto.fromAccount,
      toAccount: dto.toAccount,
      amount: dto.amount,
      currency: dto.currency,
      idempotencyKey: dto.idempotencyKey,
      ledgerEntryId: ledgerEntry.id,
    });

    return {
      status: 'success',
      transactionId: ledgerEntry.id,
      message: 'Payment recorded successfully',
    };
  }
}
