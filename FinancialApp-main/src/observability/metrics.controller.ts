import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  getMetrics() {
    const enabled = this.configService.get<boolean>('observability.metricsEnabled') ?? true;
    if (!enabled) {
      return '# Metrics disabled';
    }
    return this.metricsService.getPrometheus();
  }

  @Get('json')
  getMetricsJson() {
    const enabled = this.configService.get<boolean>('observability.metricsEnabled') ?? true;
    if (!enabled) {
      return { enabled: false };
    }
    return this.metricsService.getSnapshot();
  }
}
