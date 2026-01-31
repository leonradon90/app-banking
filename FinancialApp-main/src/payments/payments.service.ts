import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerService } from '../ledger/ledger.service';
import { CreatePaymentDto, TransferType } from './dto/create-payment.dto';
import { LimitsService } from '../limits/limits.service';
import { AuditService } from '../audit/audit.service';
import { FraudService } from './fraud.service';
import { CardControlsService } from '../card-controls/card-controls.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AuthService } from '../auth/auth.service';
import { KycStatus } from '../kyc/kyc-status.enum';
import { InterbankGatewayService } from './interbank.service';
import { Account, AccountStatus } from '../accounts/entities/account.entity';
import { User } from '../auth/entities/user.entity';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PaymentSchedule, PaymentScheduleStatus } from './entities/payment-schedule.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(PaymentSchedule)
    private readonly scheduleRepository: Repository<PaymentSchedule>,
    private readonly ledgerService: LedgerService,
    private readonly limitsService: LimitsService,
    private readonly auditService: AuditService,
    private readonly fraudService: FraudService,
    private readonly cardControlsService: CardControlsService,
    private readonly webhooksService: WebhooksService,
    private readonly authService: AuthService,
    private readonly interbankGatewayService: InterbankGatewayService,
    private readonly configService: ConfigService,
  ) {}

  async createPayment(dto: CreatePaymentDto, actor: string, userId: number) {
    const traceId = dto.traceId ?? dto.idempotencyKey;
    const scheduledFor = dto.scheduledFor ? new Date(dto.scheduledFor) : undefined;
    const transferType = dto.transferType ?? TransferType.INTERNAL;

    if (transferType === TransferType.INTERNAL && (dto.toAccount === undefined || dto.toAccount === null)) {
      throw new BadRequestException('Recipient account is required for internal transfers');
    }

    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('Invalid scheduledFor date');
    }

    if (scheduledFor && scheduledFor.getTime() > Date.now()) {
      return this.schedulePayment(dto, actor, userId, scheduledFor, traceId);
    }

    if (transferType === TransferType.INTERBANK) {
      return this.createInterbankPayment(dto, actor, userId, traceId);
    }

    return this.processImmediatePayment(dto, actor, userId, traceId);
  }

  async getSchedules(userId: number) {
    return this.scheduleRepository.find({
      where: { userId },
      order: { scheduledFor: 'DESC' },
    });
  }

  async cancelSchedule(id: number, userId: number, actor: string) {
    const schedule = await this.scheduleRepository.findOne({ where: { id, userId } });
    if (!schedule) {
      throw new BadRequestException('Schedule not found');
    }
    if (schedule.status !== PaymentScheduleStatus.SCHEDULED) {
      throw new BadRequestException('Schedule cannot be cancelled');
    }
    schedule.status = PaymentScheduleStatus.CANCELLED;
    await this.scheduleRepository.save(schedule);
    const traceId = (schedule.payload as unknown as CreatePaymentDto)?.traceId;
    await this.auditService.record(
      actor,
      'PAYMENT_SCHEDULED_CANCELLED',
      {
        scheduleId: schedule.id,
      },
      traceId,
    );
    return schedule;
  }

  async executeScheduledPayment(schedule: PaymentSchedule) {
    const payload = schedule.payload as unknown as CreatePaymentDto;
    const traceId = payload.traceId ?? payload.idempotencyKey;
    if ((payload.transferType ?? TransferType.INTERNAL) === TransferType.INTERBANK) {
      return this.createInterbankPayment(payload, schedule.actor, schedule.userId, traceId);
    }
    return this.processImmediatePayment(payload, schedule.actor, schedule.userId, traceId);
  }

  private async processImmediatePayment(
    dto: CreatePaymentDto,
    actor: string,
    userId: number,
    traceId: string,
  ) {
    await this.ensureKycVerified(userId, actor, traceId);
    await this.fraudService.validatePayment(actor, dto, dto.fromAccount, traceId);

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
        traceId,
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
    }, traceId);

    await this.webhooksService.notify('PAYMENT_COMPLETED', {
      actor,
      fromAccount: dto.fromAccount,
      toAccount: dto.toAccount,
      amount: dto.amount,
      currency: dto.currency,
      idempotencyKey: dto.idempotencyKey,
      ledgerEntryId: ledgerEntry.id,
      traceId,
    });

    return {
      status: 'success',
      transactionId: ledgerEntry.id,
      transaction_id: ledgerEntry.id,
      message: 'Payment recorded successfully',
      validatedChecks: {
        fraud: true,
        cardControls: dto.cardToken ? true : 'N/A',
        limits: true,
        idempotency: true,
      },
    };
  }

  private async createInterbankPayment(
    dto: CreatePaymentDto,
    actor: string,
    userId: number,
    traceId: string,
  ) {
    await this.ensureKycVerified(userId, actor, traceId);
    await this.fraudService.validatePayment(actor, dto, dto.fromAccount, traceId);
    if (dto.cardToken) {
      await this.cardControlsService.validateCardTransaction(
        dto.cardToken,
        dto.amount,
        dto.mcc,
        dto.geoLocation,
      );
    }
    await this.limitsService.evaluate(actor, dto);

    const gatewayResponse = await this.interbankGatewayService.initiateTransfer({
      amount: dto.amount,
      currency: dto.currency,
      beneficiaryIban: dto.beneficiaryIban,
      beneficiaryBank: dto.beneficiaryBank,
      reference: dto.idempotencyKey,
    });

    const clearingAccount = await this.getOrCreateClearingAccount(dto.currency);
    const ledgerEntry = await this.ledgerService.recordTransfer(
      {
        debitAccountId: dto.fromAccount,
        creditAccountId: clearingAccount.id,
        amount: dto.amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
        traceId,
      },
      actor,
    );

    await this.auditService.record(
      actor,
      'INTERBANK_TRANSFER_INITIATED',
      {
        fromAccount: dto.fromAccount,
        amount: dto.amount,
        currency: dto.currency,
        beneficiaryIban: dto.beneficiaryIban,
        beneficiaryBank: dto.beneficiaryBank,
        gatewayReference: gatewayResponse.reference,
        ledgerEntryId: ledgerEntry.id,
      },
      traceId,
    );

    await this.webhooksService.notify('INTERBANK_TRANSFER_INITIATED', {
      actor,
      fromAccount: dto.fromAccount,
      amount: dto.amount,
      currency: dto.currency,
      beneficiaryIban: dto.beneficiaryIban,
      beneficiaryBank: dto.beneficiaryBank,
      idempotencyKey: dto.idempotencyKey,
      ledgerEntryId: ledgerEntry.id,
      gatewayReference: gatewayResponse.reference,
      traceId,
    });

    return {
      status: 'pending',
      transactionId: ledgerEntry.id,
      transaction_id: ledgerEntry.id,
      gatewayReference: gatewayResponse.reference,
      message: 'Interbank transfer accepted for processing',
    };
  }

  private async schedulePayment(
    dto: CreatePaymentDto,
    actor: string,
    userId: number,
    scheduledFor: Date,
    traceId: string,
  ) {
    const maxAttempts = this.configService.get<number>('scheduler.maxAttempts') ?? 3;
    const schedule = this.scheduleRepository.create({
      userId,
      actor,
      scheduledFor,
      payload: {
        ...dto,
        scheduledFor: undefined,
        traceId,
      },
      status: PaymentScheduleStatus.SCHEDULED,
      maxAttempts,
    });
    const saved = await this.scheduleRepository.save(schedule);

    await this.auditService.record(
      actor,
      'PAYMENT_SCHEDULED',
      {
        scheduleId: saved.id,
        fromAccount: dto.fromAccount,
        toAccount: dto.toAccount,
        amount: dto.amount,
        currency: dto.currency,
        scheduledFor,
      },
      traceId,
    );

    return {
      status: 'scheduled',
      scheduleId: saved.id,
      scheduledFor: saved.scheduledFor,
      message: 'Payment scheduled successfully',
    };
  }

  private async ensureKycVerified(userId: number, actor: string, traceId?: string) {
    const user = await this.authService.getUserById(userId);
    const kycProviderMode = this.configService.get<string>('kyc.providerMode') ?? 'stub';
    const allowReviewInStub = kycProviderMode === 'stub' && user.kycStatus === KycStatus.REVIEW;
    if (user.kycStatus !== KycStatus.VERIFIED && !allowReviewInStub) {
      await this.auditService.record(
        actor,
        'PAYMENT_KYC_BLOCKED',
        { userId, status: user.kycStatus },
        traceId,
      );
      throw new BadRequestException({
        code: 'KYC_NOT_VERIFIED',
        message: `KYC status ${user.kycStatus} is not verified. Payment blocked.`,
      });
    }
  }

  private async getOrCreateClearingAccount(currency: string) {
    const email = 'clearing@altx.finance';
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

    let account = await this.accountsRepository.findOne({
      where: { userId: user.id, currency },
    });
    if (!account) {
      account = this.accountsRepository.create({
        userId: user.id,
        currency,
        status: AccountStatus.ACTIVE,
        balance: '1000000000.00',
      });
      account = await this.accountsRepository.save(account);
    }

    return account;
  }
}
