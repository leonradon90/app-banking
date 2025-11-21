import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Kafka, Producer } from 'kafkajs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private producer?: Producer;
  private kafka?: Kafka;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const brokers = this.configService.get<string[]>('kafka.brokers') ?? [
      'localhost:9092',
    ];
    this.kafka = new Kafka({
      clientId: this.configService.get<string>('kafka.clientId'),
      brokers,
    });
    this.producer = this.kafka.producer();
    await this.producer.connect().catch((error) => {
      this.logger.warn(`Kafka connection failed: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.producer) {
      await this.producer.disconnect().catch((error) =>
        this.logger.warn(`Kafka disconnect failed: ${error.message}`),
      );
    }
  }

  emit(event: string, payload: unknown) {
    this.eventEmitter.emit(event, payload);
    if (this.producer) {
      this.producer
        .send({ topic: event, messages: [{ value: JSON.stringify(payload) }] })
        .catch((error) => this.logger.error(`Kafka emit error: ${error.message}`));
    }
  }
}
