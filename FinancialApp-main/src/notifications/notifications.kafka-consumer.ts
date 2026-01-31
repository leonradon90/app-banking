import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { verifyPayloadSignature } from '../common/utils/hmac';

@Injectable()
export class NotificationsKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsKafkaConsumer.name);
  private kafka?: Kafka;
  private consumer?: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    const kafkaEnabled = this.configService.get<boolean>('kafka.enabled') ?? true;
    const consumerEnabled =
      this.configService.get<boolean>('notifications.kafkaConsumerEnabled') ?? false;

    if (!kafkaEnabled || !consumerEnabled) {
      return;
    }

    const brokers = this.configService.get<string[]>('kafka.brokers') ?? [];
    const clientId = this.configService.get<string>('kafka.clientId') ?? 'financial-app';
    const groupId =
      this.configService.get<string>('notifications.kafkaConsumerGroupId') ??
      'financial-app-notifications';

    this.kafka = new Kafka({ clientId, brokers });
    this.consumer = this.kafka.consumer({ groupId });

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: 'transactions', fromBeginning: false });
      this.notificationsService.setKafkaConsumerActive(true);

      await this.consumer.run({
        eachMessage: async ({ message }) => {
          const value = message.value?.toString();
          if (!value) return;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(value);
          } catch (error) {
            this.logger.warn('Invalid JSON payload on transactions topic');
            return;
          }

          if (!this.verifyLedgerSignature(payload)) {
            this.logger.warn('Ledger event signature invalid or missing');
            return;
          }

          await this.notificationsService.handleKafkaTransactionEvent(payload);
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Kafka consumer failed: ${message}`);
      this.notificationsService.setKafkaConsumerActive(false);
    }
  }

  async onModuleDestroy() {
    if (this.consumer) {
      await this.consumer.disconnect().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Kafka consumer disconnect failed: ${message}`);
      });
    }
  }

  private verifyLedgerSignature(payload: Record<string, unknown>) {
    const enabled =
      this.configService.get<boolean>('ledger.eventSigningEnabled') ?? false;
    const secret = this.configService.get<string>('ledger.eventSigningSecret') ?? '';
    if (!enabled || !secret) return true;
    return verifyPayloadSignature(payload, secret);
  }
}
