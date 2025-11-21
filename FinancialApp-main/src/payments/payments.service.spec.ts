import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { LedgerService } from '../ledger/ledger.service';
import { LimitsService } from '../limits/limits.service';
import { AuditService } from '../audit/audit.service';
import { v4 as uuid } from 'uuid';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const ledgerService = { recordTransfer: jest.fn() };
  const limitsService = { evaluate: jest.fn() };
  const auditService = { record: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: LedgerService, useValue: ledgerService },
        { provide: LimitsService, useValue: limitsService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    ledgerService.recordTransfer.mockResolvedValue({ id: 42 });
    limitsService.evaluate.mockResolvedValue(true);
    auditService.record.mockResolvedValue(undefined);
  });

  it('creates payments with ledger + audit', async () => {
    const dto = {
      fromAccount: 1,
      toAccount: 2,
      amount: 100,
      currency: 'USD',
      idempotencyKey: uuid(),
    };

    const result = await service.createPayment(dto, 'user_1');

    expect(limitsService.evaluate).toHaveBeenCalledWith('user_1', dto);
    expect(ledgerService.recordTransfer).toHaveBeenCalledWith(
      {
        debitAccountId: dto.fromAccount,
        creditAccountId: dto.toAccount,
        amount: dto.amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
      },
      'user_1',
    );
    expect(auditService.record).toHaveBeenCalled();
    expect(result.transactionId).toEqual(42);
  });
});
