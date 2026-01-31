import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { LimitsModule } from '../limits/limits.module';
import { AuditModule } from '../audit/audit.module';
import { CardControlsModule } from '../card-controls/card-controls.module';
import { FraudService } from './fraud.service';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { InterbankGatewayService } from './interbank.service';
import { Account } from '../accounts/entities/account.entity';
import { User } from '../auth/entities/user.entity';
import { PaymentSchedule } from './entities/payment-schedule.entity';
import { PaymentsSchedulerService } from './payments.scheduler.service';
import { RetryService } from '../common/services/retry.service';

@Module({
  imports: [
    LedgerModule,
    LimitsModule,
    AuditModule,
    CardControlsModule,
    WebhooksModule,
    AuthModule,
    EventsModule,
    TypeOrmModule.forFeature([LedgerEntry, Account, User, PaymentSchedule]),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsSchedulerService,
    InterbankGatewayService,
    RetryService,
    FraudService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
