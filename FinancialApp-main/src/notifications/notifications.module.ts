import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Account } from '../accounts/entities/account.entity';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/entities/user.entity';
import { EventsModule } from '../events/events.module';

import { NotificationDevice } from './entities/notification-device.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsDeliveryService } from './notifications.delivery';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsKafkaConsumer } from './notifications.kafka-consumer';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationPreference,
      Notification,
      NotificationDevice,
      Account,
      User,
    ]),
    AuthModule,
    EventsModule,
    AuditModule,
  ],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationsDeliveryService,
    NotificationsKafkaConsumer,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
