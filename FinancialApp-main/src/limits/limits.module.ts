import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LimitRule } from './entities/limit-rule.entity';
import { LimitsService } from './limits.service';
import { LimitsController } from './limits.controller';
import { AuditModule } from '../audit/audit.module';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LimitRule, LedgerEntry]),
    AuditModule,
    EventsModule,
  ],
  providers: [LimitsService],
  controllers: [LimitsController],
  exports: [LimitsService],
})
export class LimitsModule {}
