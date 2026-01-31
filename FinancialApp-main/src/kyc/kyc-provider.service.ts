import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export type KycProviderPayload = {
  userId: number;
  documentType: string;
  documentNumber?: string;
  fileUrl?: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class KycProviderService {
  private readonly logger = new Logger(KycProviderService.name);

  constructor(private readonly configService: ConfigService) {}

  async submitDocument(payload: KycProviderPayload) {
    const mode = this.configService.get<string>('kyc.providerMode') ?? 'stub';
    const providerName = this.configService.get<string>('kyc.providerName') ?? 'stub';

    if (mode !== 'real') {
      this.logger.log(`Stubbed KYC provider submission for user ${payload.userId}`);
      return {
        provider: providerName,
        reference: randomUUID(),
        status: 'RECEIVED',
        mode: 'stub',
      };
    }

    return {
      provider: providerName,
      reference: randomUUID(),
      status: 'PENDING',
      mode: 'real',
      message: 'External provider integration requires credentials.',
    };
  }

  getStatus() {
    return {
      mode: this.configService.get<string>('kyc.providerMode') ?? 'stub',
      provider: this.configService.get<string>('kyc.providerName') ?? 'stub',
    };
  }
}
