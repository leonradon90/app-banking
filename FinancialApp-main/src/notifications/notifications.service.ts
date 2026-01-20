import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';
import { AuditService } from '../audit/audit.service';

export interface CreateNotificationDto {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
}

export interface PaginatedNotifications {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferencesRepository: Repository<NotificationPreference>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly auditService: AuditService,
  ) {}

  @OnEvent('transactions')
  async handleTransactionEvent(payload: any) {
    this.logger.log(`Push notification scheduled: ${JSON.stringify(payload)}`);
    
    if (payload.debitAccountId || payload.creditAccountId) {
      try {
        await this.createNotification({
          userId: payload.userId || 0, 
          type: NotificationType.TRANSACTION,
          title: 'Transaction Completed',
          message: `Transaction of ${payload.amount} ${payload.currency} has been processed`,
          metadata: payload,
          channels: ['push', 'email'],
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to create transaction notification: ${message}`);
      }
    }
    
    await this.auditService.record('system', 'NOTIFICATION_SCHEDULED', payload);
  }

  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      metadata: dto.metadata,
      channels: dto.channels || ['push'],
      status: NotificationStatus.PENDING,
    });

    const saved = await this.notificationRepository.save(notification);

    // Try to send notification based on user preferences
    await this.sendNotification(saved);

    await this.auditService.record('system', 'NOTIFICATION_CREATED', {
      notificationId: saved.id,
      userId: dto.userId,
      type: dto.type,
    });

    return saved;
  }

  private async sendNotification(notification: Notification): Promise<void> {
    try {
      const preferences = await this.getPreferences(notification.userId);
      const enabledChannels = preferences?.channels || {};

      // Check if user has enabled notifications for this channel
      const channelsToSend = notification.channels?.filter((channel) => {
        return enabledChannels[channel] !== false;
      }) || [];

      if (channelsToSend.length === 0) {
        this.logger.log(`No enabled channels for notification ${notification.id}`);
        notification.status = NotificationStatus.SENT;
        await this.notificationRepository.save(notification);
        return;
      }

      // Simulate sending notification
      // In production, this would integrate with actual push/email/SMS services
      this.logger.log(
        `Sending notification ${notification.id} via channels: ${channelsToSend.join(', ')}`,
      );

      notification.status = NotificationStatus.SENT;
      await this.notificationRepository.save(notification);

      // Simulate delivery
      setTimeout(async () => {
        notification.status = NotificationStatus.DELIVERED;
        await this.notificationRepository.save(notification);
      }, 100);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send notification: ${message}`);
      notification.status = NotificationStatus.FAILED;
      await this.notificationRepository.save(notification);
    }
  }

  async getNotifications(
    userId: number,
    page: number = 1,
    limit: number = 20,
    type?: NotificationType,
    unreadOnly: boolean = false,
  ): Promise<PaginatedNotifications> {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');

    if (type) {
      queryBuilder.andWhere('notification.type = :type', { type });
    }

    if (unreadOnly) {
      queryBuilder.andWhere('notification.status != :readStatus', {
        readStatus: NotificationStatus.READ,
      });
    }

    const total = await queryBuilder.getCount();
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const data = await queryBuilder.getMany();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getNotificationById(id: number, userId: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  async markAsRead(id: number, userId: number): Promise<Notification> {
    const notification = await this.getNotificationById(id, userId);
    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();
    const saved = await this.notificationRepository.save(notification);

    await this.auditService.record(`user_${userId}`, 'NOTIFICATION_READ', {
      notificationId: id,
    });

    return saved;
  }

  async markAllAsRead(userId: number): Promise<number> {
    const result = await this.notificationRepository.update(
      {
        userId,
        status: NotificationStatus.DELIVERED,
      },
      {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    );

    await this.auditService.record(`user_${userId}`, 'NOTIFICATIONS_MARKED_READ', {
      count: result.affected || 0,
    });

    return result.affected || 0;
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepository.count({
      where: {
        userId,
        status: NotificationStatus.DELIVERED,
      },
    });
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
