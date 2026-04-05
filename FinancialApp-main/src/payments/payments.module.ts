import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Account } from '../accounts/entities/account.entity';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/entities/user.entity';
import { CardControlsModule } from '../card-controls/card-controls.module';
import { RetryService } from '../common/services/retry.service';
import { EventsModule } from '../events/events.module';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';
import { LedgerModule } from '../ledger/ledger.module';
import { LimitsModule } from '../limits/limits.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

import { PaymentSchedule } from './entities/payment-schedule.entity';
import { FraudService } from './fraud.service';
import { InterbankGatewayService } from './interbank.service';
import { PaymentsController } from './payments.controller';
import { PaymentsSchedulerService } from './payments.scheduler.service';
import { PaymentsService } from './payments.service';

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
