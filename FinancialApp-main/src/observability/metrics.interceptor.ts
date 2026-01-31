import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { MetricsService } from './metrics.service';
import { TelemetryService } from './telemetry.service';
import { randomUUID } from 'crypto';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly telemetryService: TelemetryService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ method?: string; traceId?: string }>();
    const response = http.getResponse<{ statusCode?: number }>();

    const start = Date.now();
    const traceId = request.traceId ?? randomUUID();
    this.telemetryService.startSpan('http_request', traceId, {
      method: request.method,
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const status = response.statusCode ?? 200;
        this.metricsService.recordRequest(request.method ?? 'GET', status, duration);
        this.telemetryService.endSpan('http_request', traceId, { status, duration });
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        const status = (error?.status as number) ?? 500;
        this.metricsService.recordRequest(request.method ?? 'GET', status, duration);
        this.telemetryService.endSpan('http_request', traceId, { status, duration });
        return throwError(() => error);
      }),
    );
  }
}
