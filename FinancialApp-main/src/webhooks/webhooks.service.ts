import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly configService: ConfigService) {}

  async notify(event: string, payload: Record<string, unknown>) {
    const enabled = this.configService.get<boolean>('webhooks.enabled') ?? false;
    const url = this.configService.get<string>('webhooks.url') ?? '';
    const secret = this.configService.get<string>('webhooks.secret') ?? '';

    if (!enabled || !url) {
      return;
    }

    const body = {
      event,
      payload,
      emittedAt: new Date().toISOString(),
    };
    const signature = this.signPayload(body, secret);

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body: JSON.stringify(body),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Webhook dispatch failed: ${message}`);
    }
  }

  private signPayload(payload: Record<string, unknown>, secret: string) {
    if (!secret) return '';
    return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }
}
