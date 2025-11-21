import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './common/config/configuration';
import { validationSchema } from './common/config/validation';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { PaymentsModule } from './payments/payments.module';
import { LedgerModule } from './ledger/ledger.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LimitsModule } from './limits/limits.module';
import { KycModule } from './kyc/kyc.module';
import { CardControlsModule } from './card-controls/card-controls.module';
import { EventsModule } from './events/events.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
  providers: [AppService],
})
export class AppModule {}
