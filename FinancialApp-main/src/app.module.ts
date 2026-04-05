import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountsModule } from './accounts/accounts.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CardControlsModule } from './card-controls/card-controls.module';
import configuration from './common/config/configuration';
import { validationSchema } from './common/config/validation';
import { EventsModule } from './events/events.module';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { KycModule } from './kyc/kyc.module';
import { LedgerModule } from './ledger/ledger.module';
import { LimitsModule } from './limits/limits.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MetricsInterceptor } from './observability/metrics.interceptor';
import { MetricsModule } from './observability/metrics.module';
import { PaymentsModule } from './payments/payments.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.POSTGRES_HOST ?? 'localhost',
        port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
        username: process.env.POSTGRES_USER ?? 'postgres',
        password: process.env.POSTGRES_PASSWORD ?? 'postgres',
        database: process.env.POSTGRES_DB ?? 'financial_app',
        autoLoadEntities: true,
        synchronize: false,
        logging: process.env.TYPEORM_LOGGING === 'true',
      }),
    }),
    EventsModule,
    IdempotencyModule,
    WebhooksModule,
    MetricsModule,
    AuthModule,
    AccountsModule,
    LedgerModule,
    PaymentsModule,
    AuditModule,
    NotificationsModule,
    LimitsModule,
    KycModule,
    CardControlsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
