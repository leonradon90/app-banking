import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import * as sendgrid from '@sendgrid/mail';
import { Notification } from './entities/notification.entity';
import { NotificationDevice } from './entities/notification-device.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsDeliveryService {
  private readonly logger = new Logger(NotificationsDeliveryService.name);
  private firebaseReady = false;
  private sendgridReady = false;
  private mode: 'real' | 'stub' = 'stub';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(NotificationDevice)
    private readonly deviceRepository: Repository<NotificationDevice>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly gateway: NotificationsGateway,
  ) {
    this.mode = (this.configService.get<string>('notifications.mode') ?? 'stub') as
      | 'real'
      | 'stub';
    this.initFirebase();
    this.initSendgrid();
  }

  private initFirebase() {
    const firebase = this.configService.get('notifications.firebase') as {
      projectId: string;
      clientEmail: string;
      privateKey: string;
      appId: string;
    };

    if (!firebase?.projectId || !firebase.clientEmail || !firebase.privateKey) {
      this.logger.warn('Firebase credentials missing. Push notifications will be stubbed.');
      return;
    }

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: firebase.projectId,
          clientEmail: firebase.clientEmail,
          privateKey: firebase.privateKey.replace(/\\n/g, '\n'),
        }),
      });
    }
    this.firebaseReady = true;
  }

  private initSendgrid() {
    const sendgridConfig = this.configService.get('notifications.sendgrid') as {
      apiKey: string;
      fromEmail: string;
      fromName: string;
    };

    if (!sendgridConfig?.apiKey || !sendgridConfig?.fromEmail) {
      this.logger.warn('Sendgrid credentials missing. Email notifications will be stubbed.');
      return;
    }

    sendgrid.setApiKey(sendgridConfig.apiKey);
    this.sendgridReady = true;
  }

  async deliver(notification: Notification, channels: string[]) {
    const results: { channel: string; success: boolean }[] = [];

    for (const channel of channels) {
      if (channel === 'push') {
        const success = await this.sendPush(notification);
        results.push({ channel, success });
      } else if (channel === 'email') {
        const success = await this.sendEmail(notification);
        results.push({ channel, success });
      } else if (channel === 'websocket') {
        const success = await this.sendWebsocket(notification);
        results.push({ channel, success });
      }
    }

    return results;
  }

  private async sendPush(notification: Notification): Promise<boolean> {
    if (this.mode !== 'real' || !this.firebaseReady) {
      this.logger.log(`Stubbed push for notification ${notification.id}`);
      return true;
    }

    const devices = await this.deviceRepository.find({
      where: { userId: notification.userId, enabled: true },
    });
    const tokens = devices.map((device) => device.token);
    if (tokens.length === 0) {
      this.logger.warn(`No device tokens for user ${notification.userId}`);
      return false;
    }

    try {
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: notification.title,
          body: notification.message,
        },
        data: {
          notificationId: String(notification.id),
        },
      });
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`FCM delivery failed: ${message}`);
      return false;
    }
  }

  private async sendEmail(notification: Notification): Promise<boolean> {
    if (this.mode !== 'real' || !this.sendgridReady) {
      this.logger.log(`Stubbed email for notification ${notification.id}`);
      return true;
    }

    const user = await this.userRepository.findOne({
      where: { id: notification.userId },
    });
    if (!user?.email) {
      this.logger.warn(`User ${notification.userId} has no email`);
      return false;
    }

    const sendgridConfig = this.configService.get('notifications.sendgrid') as {
      fromEmail: string;
      fromName: string;
    };

    try {
      await sendgrid.send({
        to: user.email,
        from: {
          email: sendgridConfig.fromEmail,
          name: sendgridConfig.fromName,
        },
        subject: notification.title,
        text: notification.message,
        html: `<p>${notification.message}</p>`,
      });
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sendgrid delivery failed: ${message}`);
      return false;
    }
  }

  private async sendWebsocket(notification: Notification): Promise<boolean> {
    try {
      this.gateway.emitToUser(notification.userId, {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        status: notification.status,
        createdAt: notification.createdAt,
      });
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`WebSocket delivery failed: ${message}`);
      return false;
    }
  }
}
