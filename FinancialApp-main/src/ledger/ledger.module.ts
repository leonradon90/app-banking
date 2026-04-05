import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';

import { LedgerEntry } from './entities/ledger-entry.entity';
import { IdempotencyService } from './idempotency.service';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntry]), AuditModule, EventsModule],
  providers: [LedgerService, IdempotencyService],
  controllers: [LedgerController],
  exports: [LedgerService, IdempotencyService],
})
export class LedgerModule {}
