import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventsService } from './events.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [EventsService],
  exports: [EventEmitterModule, EventsService],
})
export class EventsModule {}
