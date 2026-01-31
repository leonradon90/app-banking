import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RetryService } from '../common/services/retry.service';

export type InterbankTransferRequest = {
  amount: number;
  currency: string;
  beneficiaryIban?: string;
  beneficiaryBank?: string;
  reference?: string;
};

@Injectable()
export class InterbankGatewayService {
  private readonly logger = new Logger(InterbankGatewayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly retryService: RetryService,
  ) {}

  async initiateTransfer(payload: InterbankTransferRequest) {
    const mode = this.configService.get<string>('interbank.mode') ?? 'stub';
    const retryAttempts = this.configService.get<number>('interbank.retryMaxAttempts') ?? 3;
    const retryBackoffMs = this.configService.get<number>('interbank.retryBackoffMs') ?? 250;

    if (mode !== 'real') {
      return this.retryService.execute(
        async () => this.stubTransfer(payload),
        { attempts: retryAttempts, backoffMs: retryBackoffMs },
      );
    }

    return {
      status: 'PENDING',
      reference: randomUUID(),
      provider: this.configService.get<string>('interbank.provider') ?? 'external',
      mode: 'real',
      message: 'External interbank gateway requires credentials.',
    };
  }

  private async stubTransfer(payload: InterbankTransferRequest) {
    const failureRate =
      parseFloat(this.configService.get<string>('interbank.stubFailureRate') ?? '0') || 0;
    if (Math.random() < failureRate) {
      this.logger.warn('Stubbed interbank transfer failed (simulated).');
      throw new Error('Simulated interbank gateway failure');
    }

    this.logger.log(
      `Stubbed interbank transfer accepted for ${payload.amount} ${payload.currency}`,
    );

    return {
      status: 'ACCEPTED',
      reference: randomUUID(),
      provider: 'stub',
      mode: 'stub',
    };
  }
}
