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

@Module({
  imports: [
    LedgerModule,
    LimitsModule,
    AuditModule,
    CardControlsModule,
    TypeOrmModule.forFeature([LedgerEntry]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, FraudService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
