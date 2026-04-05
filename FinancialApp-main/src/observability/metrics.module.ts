import { Module } from '@nestjs/common';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { TelemetryService } from './telemetry.service';

@Module({
  providers: [MetricsService, TelemetryService],
  controllers: [MetricsController],
  exports: [MetricsService, TelemetryService],
})
export class MetricsModule {}
