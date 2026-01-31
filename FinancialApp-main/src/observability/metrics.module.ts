import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  providers: [MetricsService, TelemetryService],
  controllers: [MetricsController],
  exports: [MetricsService, TelemetryService],
})
export class MetricsModule {}
