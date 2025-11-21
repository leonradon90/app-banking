import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardControl } from './entities/card-control.entity';
import { CardControlsService } from './card-controls.service';
import { CardControlsController } from './card-controls.controller';
import { EventsModule } from '../events/events.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([CardControl]), EventsModule, AuditModule],
  providers: [CardControlsService],
  controllers: [CardControlsController],
  exports: [CardControlsService],
})
export class CardControlsModule {}
