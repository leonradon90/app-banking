import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, from, of, switchMap, tap, throwError } from 'rxjs';
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyStatus } from './entities/idempotency-key.entity';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (request.method.toUpperCase() !== 'POST') {
      return next.handle();
    }

    const idempotencyKey = request.header('Idempotency-Key');
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required for POST requests');
    }

    const endpoint = `${request.method.toUpperCase()} ${request.baseUrl || ''}${request.path}`;
    const scope =
      (request as any).user?.userId?.toString() ??
      (request.body?.email as string | undefined) ??
      request.ip ??
      null;
    const requestHash = hashPayload({
      body: request.body ?? {},
      query: request.query ?? {},
      scope,
    });

    return from(
      this.idempotencyService.findExisting({
        idempotencyKey,
        endpoint,
        scope,
      }),
    ).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException(
              'Idempotency-Key was already used with a different payload',
            );
          }
          if (existing.status === IdempotencyStatus.PROCESSING) {
            throw new ConflictException('Request with this Idempotency-Key is still processing');
          }
          response.status(existing.responseStatus ?? 200);
          return of(existing.responseBody ?? {});
        }

        return from(
          this.idempotencyService.startRequest({
            idempotencyKey,
            endpoint,
            scope,
            requestHash,
          }),
        ).pipe(
          switchMap((record) =>
            next.handle().pipe(
              tap(async (body) => {
                await this.idempotencyService.markCompleted(
                  record.id,
                  response.statusCode,
                  body,
                );
              }),
              catchError((error) => {
                const statusCode = (error?.status as number) ?? 500;
                const body = error?.response ?? { message: error?.message ?? 'Request failed' };
                return from(
                  this.idempotencyService.markFailed(record.id, statusCode, body),
                ).pipe(switchMap(() => throwError(() => error)));
              }),
            ),
          ),
        );
      }),
    );
  }
}
