import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { LedgerService } from './ledger.service';
import { IdempotencyService } from './idempotency.service';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { LedgerController } from './ledger.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerEntry]),
    AuditModule,
    EventsModule,
  ],
  providers: [LedgerService, IdempotencyService],
  controllers: [LedgerController],
  exports: [LedgerService, IdempotencyService],
})
export class LedgerModule {}
