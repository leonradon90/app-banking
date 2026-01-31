import { Injectable } from '@nestjs/common';

type MetricKey = string;

@Injectable()
export class MetricsService {
  private readonly requestCounts = new Map<MetricKey, number>();
  private latencySum = 0;
  private latencyCount = 0;

  recordRequest(method: string, status: number, durationMs: number) {
    const key = `${method}:${status}`;
    const current = this.requestCounts.get(key) ?? 0;
    this.requestCounts.set(key, current + 1);
    this.latencySum += durationMs;
    this.latencyCount += 1;
  }

  getSnapshot() {
    return {
      counts: Array.from(this.requestCounts.entries()).map(([key, count]) => {
        const [method, status] = key.split(':');
        return { method, status, count };
      }),
      latency: {
        count: this.latencyCount,
        sumMs: this.latencySum,
        avgMs: this.latencyCount > 0 ? this.latencySum / this.latencyCount : 0,
      },
    };
  }

  getPrometheus() {
    const lines: string[] = [];
    lines.push('# HELP http_requests_total Total HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    for (const [key, count] of this.requestCounts.entries()) {
      const [method, status] = key.split(':');
      lines.push(
        `http_requests_total{method="${method}",status="${status}"} ${count}`,
      );
    }
    lines.push('# HELP http_request_duration_ms Total request duration in ms');
    lines.push('# TYPE http_request_duration_ms summary');
    lines.push(`http_request_duration_ms_sum ${this.latencySum}`);
    lines.push(`http_request_duration_ms_count ${this.latencyCount}`);
    return lines.join('\n');
  }
}
