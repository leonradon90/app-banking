import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentSchedule, PaymentScheduleStatus } from './entities/payment-schedule.entity';
import { PaymentsService } from './payments.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsSchedulerService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(PaymentSchedule)
    private readonly scheduleRepository: Repository<PaymentSchedule>,
    private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.configService.get<boolean>('scheduler.enabled') ?? false;
    if (!enabled) return;
    const interval = this.configService.get<number>('scheduler.pollIntervalMs') ?? 30000;
    this.timer = setInterval(() => this.tick(), interval);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async tick() {
    const now = new Date();
    const due = await this.scheduleRepository.find({
      where: {
        status: PaymentScheduleStatus.SCHEDULED,
        scheduledFor: LessThanOrEqual(now),
      },
      take: 10,
      order: { scheduledFor: 'ASC' },
    });

    for (const schedule of due) {
      await this.processSchedule(schedule);
    }
  }

  private async processSchedule(schedule: PaymentSchedule) {
    schedule.status = PaymentScheduleStatus.PROCESSING;
    await this.scheduleRepository.save(schedule);

    try {
      const result = await this.paymentsService.executeScheduledPayment(schedule);
      const traceId = (schedule.payload as { traceId?: string })?.traceId;
      schedule.status = PaymentScheduleStatus.COMPLETED;
      schedule.ledgerEntryId = result.transactionId ?? result.transaction_id;
      schedule.processedAt = new Date();
      schedule.lastError = undefined;
      await this.scheduleRepository.save(schedule);
      await this.auditService.record(schedule.actor, 'PAYMENT_SCHEDULED_EXECUTED', {
        scheduleId: schedule.id,
        ledgerEntryId: schedule.ledgerEntryId,
      }, traceId);
    } catch (error: unknown) {
      schedule.attempts += 1;
      schedule.lastError = error instanceof Error ? error.message : String(error);
      const maxAttempts = schedule.maxAttempts ?? 3;
      if (schedule.attempts >= maxAttempts) {
        schedule.status = PaymentScheduleStatus.FAILED;
      } else {
        schedule.status = PaymentScheduleStatus.SCHEDULED;
        const backoffMs = this.configService.get<number>('scheduler.retryBackoffMs') ?? 60000;
        schedule.scheduledFor = new Date(Date.now() + backoffMs * schedule.attempts);
      }
      await this.scheduleRepository.save(schedule);
      this.logger.warn(`Scheduled payment ${schedule.id} failed: ${schedule.lastError}`);
      const traceId = (schedule.payload as { traceId?: string })?.traceId;
      await this.auditService.record(schedule.actor, 'PAYMENT_SCHEDULED_FAILED', {
        scheduleId: schedule.id,
        attempts: schedule.attempts,
        lastError: schedule.lastError,
      }, traceId);
    }
  }
}
