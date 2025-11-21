import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationPreference } from './entities/notification-preference.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferencesRepository: Repository<NotificationPreference>,
    private readonly auditService: AuditService,
  ) {}

  @OnEvent('transactions')
  async handleTransactionEvent(payload: any) {
    this.logger.log(`Push notification scheduled: ${JSON.stringify(payload)}`);
    await this.auditService.record('system', 'NOTIFICATION_SCHEDULED', payload);
  }

  async upsertPreferences(userId: number, channels: Record<string, boolean>) {
    let preference = await this.preferencesRepository.findOne({ where: { userId } });
    if (!preference) {
      preference = this.preferencesRepository.create({ userId, channels });
    } else {
      preference.channels = channels;
    }
    const saved = await this.preferencesRepository.save(preference);
    await this.auditService.record(`user_${userId}`, 'NOTIFICATION_PREFERENCE_UPDATED', channels);
    return saved;
  }

  async getPreferences(userId: number) {
    return this.preferencesRepository.findOne({ where: { userId } });
  }
}
