import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { LedgerService } from '../ledger/ledger.service';
import { LimitsService } from '../limits/limits.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuid } from 'uuid';
import { FraudService } from './fraud.service';
import { CardControlsService } from '../card-controls/card-controls.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AuthService } from '../auth/auth.service';
import { KycStatus } from '../kyc/kyc-status.enum';
import { InterbankGatewayService } from './interbank.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Account } from '../accounts/entities/account.entity';
import { User } from '../auth/entities/user.entity';
import { PaymentSchedule } from './entities/payment-schedule.entity';
import { ConfigService } from '@nestjs/config';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const ledgerService = { recordTransfer: jest.fn() };
  const limitsService = { evaluate: jest.fn() };
  const auditService = { record: jest.fn() };
  const fraudService = { validatePayment: jest.fn() };
  const cardControlsService = { validateCardTransaction: jest.fn() };
  const webhooksService = { notify: jest.fn() };
  const authService = { getUserById: jest.fn() };
  const interbankGatewayService = { initiateTransfer: jest.fn() };
  const accountsRepository = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const usersRepository = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const scheduleRepository = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const configService = { get: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: LedgerService, useValue: ledgerService },
        { provide: LimitsService, useValue: limitsService },
        { provide: AuditService, useValue: auditService },
        { provide: FraudService, useValue: fraudService },
        { provide: CardControlsService, useValue: cardControlsService },
        { provide: WebhooksService, useValue: webhooksService },
        { provide: AuthService, useValue: authService },
        { provide: InterbankGatewayService, useValue: interbankGatewayService },
        { provide: getRepositoryToken(Account), useValue: accountsRepository },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: getRepositoryToken(PaymentSchedule), useValue: scheduleRepository },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    ledgerService.recordTransfer.mockResolvedValue({ id: 42 });
    limitsService.evaluate.mockResolvedValue(true);
    auditService.record.mockResolvedValue(undefined);
    fraudService.validatePayment.mockResolvedValue({ passed: true, riskScore: 0 });
    webhooksService.notify.mockResolvedValue(undefined);
    authService.getUserById.mockResolvedValue({ id: 1, kycStatus: KycStatus.VERIFIED });
  });

  it('creates payments with ledger + audit', async () => {
    const dto = {
      fromAccount: 1,
      toAccount: 2,
      amount: 100,
      currency: 'USD',
      idempotencyKey: uuid(),
    };

    const result = await service.createPayment(dto, 'user_1', 1);

    expect(limitsService.evaluate).toHaveBeenCalledWith('user_1', dto);
    expect(fraudService.validatePayment).toHaveBeenCalledWith(
      'user_1',
      dto,
      dto.fromAccount,
      dto.idempotencyKey,
    );
    expect(ledgerService.recordTransfer).toHaveBeenCalledWith(
      {
        debitAccountId: dto.fromAccount,
        creditAccountId: dto.toAccount,
        amount: dto.amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
        traceId: dto.idempotencyKey,
      },
      'user_1',
    );
    expect(auditService.record).toHaveBeenCalled();
    expect('transactionId' in result ? result.transactionId : null).toEqual(42);
  });
});
