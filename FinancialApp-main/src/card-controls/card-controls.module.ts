import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Account } from '../accounts/entities/account.entity';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';

import { CardControlsController } from './card-controls.controller';
import { CardControlsService } from './card-controls.service';
import { CardControl } from './entities/card-control.entity';
import { TokenizationService } from './tokenization.service';

@Module({
  imports: [TypeOrmModule.forFeature([CardControl, Account]), EventsModule, AuditModule],
  providers: [CardControlsService, TokenizationService],
  controllers: [CardControlsController],
  exports: [CardControlsService],
})
export class CardControlsModule {}
