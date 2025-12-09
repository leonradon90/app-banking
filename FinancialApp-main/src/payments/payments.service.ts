import { Injectable } from '@nestjs/common';
import { LedgerService } from '../ledger/ledger.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { LimitsService } from '../limits/limits.service';
import { AuditService } from '../audit/audit.service';
import { FraudService } from './fraud.service';
import { CardControlsService } from '../card-controls/card-controls.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly limitsService: LimitsService,
    private readonly auditService: AuditService,
    private readonly fraudService: FraudService,
    private readonly cardControlsService: CardControlsService,
  ) {}

  async createPayment(dto: CreatePaymentDto, actor: string) {
    await this.fraudService.validatePayment(actor, dto, dto.fromAccount);

    if (dto.cardToken) {
      await this.cardControlsService.validateCardTransaction(
        dto.cardToken,
        dto.amount,
        dto.mcc,
        dto.geoLocation,
      );
    }

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

    await this.auditService.record(actor, 'PAYMENT_COMPLETED', {
      fromAccount: dto.fromAccount,
      toAccount: dto.toAccount,
      amount: dto.amount,
      currency: dto.currency,
      idempotencyKey: dto.idempotencyKey,
      ledgerEntryId: ledgerEntry.id,
      cardToken: dto.cardToken,
      mcc: dto.mcc,
      geoLocation: dto.geoLocation,
      description: dto.description,
    });

    return {
      status: 'success',
      transactionId: ledgerEntry.id,
      message: 'Payment successfully processed after passing all validations',
      validatedChecks: {
        fraud: true,
        cardControls: dto.cardToken ? true : 'N/A',
        limits: true,
        idempotency: true,
      },
    };
  }
}
