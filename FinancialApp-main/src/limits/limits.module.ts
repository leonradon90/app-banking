import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { LedgerEntry } from '../ledger/entities/ledger-entry.entity';

import { LimitRule } from './entities/limit-rule.entity';
import { LimitsController } from './limits.controller';
import { LimitsService } from './limits.service';

@Module({
  imports: [TypeOrmModule.forFeature([LimitRule, LedgerEntry]), AuditModule, EventsModule],
  providers: [LimitsService],
  controllers: [LimitsController],
  exports: [LimitsService],
})
export class LimitsModule {}
