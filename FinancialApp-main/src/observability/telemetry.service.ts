import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(private readonly configService: ConfigService) {}

  startSpan(name: string, traceId: string, metadata?: Record<string, unknown>) {
    const enabled = this.configService.get<boolean>('observability.traceEnabled') ?? true;
    if (!enabled) return;
    this.logger.log(`[trace:${traceId}] start ${name} ${JSON.stringify(metadata ?? {})}`);
  }

  endSpan(name: string, traceId: string, metadata?: Record<string, unknown>) {
    const enabled = this.configService.get<boolean>('observability.traceEnabled') ?? true;
    if (!enabled) return;
    this.logger.log(`[trace:${traceId}] end ${name} ${JSON.stringify(metadata ?? {})}`);
  }
}
