import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Notification } from './entities/notification.entity';
import { Account } from '../accounts/entities/account.entity';
import { NotificationDevice } from './entities/notification-device.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EventsModule } from '../events/events.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsDeliveryService } from './notifications.delivery';
import { AuthModule } from '../auth/auth.module';
import { NotificationsKafkaConsumer } from './notifications.kafka-consumer';

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
