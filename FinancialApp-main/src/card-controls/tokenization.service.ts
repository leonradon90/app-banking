import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createHash, createHmac, randomUUID } from 'crypto';

export type TokenizationResult = {
  cardToken: string;
  panLast4: string;
  panEncrypted?: string;
  mode: 'stub' | 'real';
};

@Injectable()
export class TokenizationService {
  constructor(private readonly configService: ConfigService) {}

  tokenizePan(pan: string): TokenizationResult {
    const normalized = pan.replace(/\s+/g, '');
    const panLast4 = normalized.slice(-4);
    const mode = (this.configService.get<string>('cardVault.mode') ?? 'stub') as
      | 'stub'
      | 'real';

    const tokenSecret =
      this.configService.get<string>('cardVault.tokenizationSecret') ?? 'stub-token';
    const cardToken =
      mode === 'real'
        ? createHmac('sha256', tokenSecret).update(normalized).digest('hex').slice(0, 32)
        : randomUUID();

    const encryptionKey =
      this.configService.get<string>('cardVault.encryptionKey') ?? '';
    const panEncrypted =
      mode === 'real' && encryptionKey
        ? this.encryptPan(normalized, encryptionKey)
        : undefined;

    return {
      cardToken,
      panLast4,
      panEncrypted,
      mode,
    };
  }

  private encryptPan(pan: string, key: string) {
    const cryptoKey = createHash('sha256').update(key).digest();
    const iv = createHash('sha256').update(randomUUID()).digest().subarray(0, 12);
    const cipher = createCipheriv('aes-256-gcm', cryptoKey, iv);
    const encrypted = Buffer.concat([cipher.update(pan, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }
}
