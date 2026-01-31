import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';
import { Account } from '../accounts/entities/account.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsDeliveryService } from './notifications.delivery';
import { NotificationDevice } from './entities/notification-device.entity';
import { EventsService } from '../events/events.service';
import { ConfigService } from '@nestjs/config';

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
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(NotificationDevice)
    private readonly deviceRepository: Repository<NotificationDevice>,
    private readonly auditService: AuditService,
    private readonly deliveryService: NotificationsDeliveryService,
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {}

  private kafkaConsumerActive = false;

  setKafkaConsumerActive(active: boolean) {
    this.kafkaConsumerActive = active;
  }

  @OnEvent('transactions')
  async handleTransactionEvent(payload: Record<string, any>) {
    if (this.kafkaConsumerActive) {
      return;
    }
    await this.processTransactionEvent(payload);
  }

  async handleKafkaTransactionEvent(payload: Record<string, any>) {
    await this.processTransactionEvent(payload);
  }

  private async processTransactionEvent(payload: Record<string, any>) {
    this.logger.log(`Push notification scheduled: ${JSON.stringify(payload)}`);

    const debitAccountId = payload.debitAccountId;
    const creditAccountId = payload.creditAccountId;
    const notifications: CreateNotificationDto[] = [];

    if (payload.userId) {
      notifications.push({
        userId: payload.userId,
        type: NotificationType.TRANSACTION,
        title: 'Transaction Completed',
        message: `Transaction of ${payload.amount} ${payload.currency} has been processed`,
        metadata: payload,
        channels: ['push', 'email', 'websocket'],
      });
    } else if (debitAccountId || creditAccountId) {
      const accountIds = [debitAccountId, creditAccountId].filter(Boolean);
      const accounts = accountIds.length
        ? await this.accountsRepository.find({ where: accountIds.map((id) => ({ id })) })
        : [];
      const debitAccount = accounts.find((account) => account.id === debitAccountId);
      const creditAccount = accounts.find((account) => account.id === creditAccountId);

      if (debitAccount) {
        notifications.push({
          userId: debitAccount.userId,
          type: NotificationType.TRANSACTION,
          title: 'Transfer sent',
          message: `You sent ${payload.amount} ${payload.currency}`,
          metadata: payload,
          channels: ['push', 'email', 'websocket'],
        });
      }

      if (creditAccount && creditAccount.userId !== debitAccount?.userId) {
        notifications.push({
          userId: creditAccount.userId,
          type: NotificationType.TRANSACTION,
          title: 'Transfer received',
          message: `You received ${payload.amount} ${payload.currency}`,
          metadata: payload,
          channels: ['push', 'email', 'websocket'],
        });
      }
    }

    try {
      for (const notification of notifications) {
        await this.createNotification(notification);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create transaction notification: ${message}`);
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
      channels: dto.channels || ['push', 'email', 'websocket'],
      status: NotificationStatus.PENDING,
    });

    const saved = await this.notificationRepository.save(notification);

    this.eventsService.emit('notifications', {
      type: 'NOTIFICATION_CREATED',
      notificationId: saved.id,
      userId: saved.userId,
      channels: saved.channels,
      status: saved.status,
      createdAt: saved.createdAt,
    });

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

      this.logger.log(
        `Sending notification ${notification.id} via channels: ${channelsToSend.join(', ')}`,
      );

      const results = await this.deliveryService.deliver(notification, channelsToSend);
      const allSucceeded = results.every((result) => result.success);

      notification.status = allSucceeded ? NotificationStatus.DELIVERED : NotificationStatus.FAILED;
      await this.notificationRepository.save(notification);

      this.eventsService.emit('notifications', {
        type: 'NOTIFICATION_STATUS_UPDATED',
        notificationId: notification.id,
        userId: notification.userId,
        status: notification.status,
        channels: channelsToSend,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send notification: ${message}`);
      notification.status = NotificationStatus.FAILED;
      await this.notificationRepository.save(notification);

      this.eventsService.emit('notifications', {
        type: 'NOTIFICATION_STATUS_UPDATED',
        notificationId: notification.id,
        userId: notification.userId,
        status: notification.status,
        channels: notification.channels,
      });
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
        status: In([NotificationStatus.DELIVERED, NotificationStatus.SENT]),
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
        status: In([NotificationStatus.DELIVERED, NotificationStatus.SENT]),
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

  async registerDevice(userId: number, token: string, platform: string = 'web') {
    const existing = await this.deviceRepository.findOne({
      where: { userId, token },
    });
    if (existing) {
      existing.enabled = true;
      existing.platform = platform;
      return this.deviceRepository.save(existing);
    }
    const device = this.deviceRepository.create({ userId, token, platform, enabled: true });
    const saved = await this.deviceRepository.save(device);
    await this.auditService.record(`user_${userId}`, 'NOTIFICATION_DEVICE_REGISTERED', {
      deviceId: saved.id,
      platform,
    });
    return saved;
  }
}
