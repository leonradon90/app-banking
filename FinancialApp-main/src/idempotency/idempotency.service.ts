import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  IdempotencyKey,
  IdempotencyStatus,
} from './entities/idempotency-key.entity';

export type IdempotencyLookup = {
  idempotencyKey: string;
  endpoint: string;
  scope: string | null;
  requestHash: string;
};

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepository: Repository<IdempotencyKey>,
  ) {}

  async findExisting({
    idempotencyKey,
    endpoint,
    scope,
  }: Pick<IdempotencyLookup, 'idempotencyKey' | 'endpoint' | 'scope'>) {
    return this.idempotencyRepository.findOne({
      where: {
        idempotencyKey,
        endpoint,
        scope: scope === null ? IsNull() : scope,
      },
    });
  }

  async startRequest(payload: IdempotencyLookup) {
    const record = this.idempotencyRepository.create({
      idempotencyKey: payload.idempotencyKey,
      endpoint: payload.endpoint,
      scope: payload.scope,
      requestHash: payload.requestHash,
      status: IdempotencyStatus.PROCESSING,
    });

    return this.idempotencyRepository.save(record);
  }

  async markCompleted(id: number, responseStatus: number, responseBody: unknown) {
    const record = await this.idempotencyRepository.findOne({ where: { id } });
    if (!record) return;
    record.status = IdempotencyStatus.COMPLETED;
    record.responseStatus = responseStatus;
    record.responseBody = (responseBody ?? null) as Record<string, unknown> | null;
    await this.idempotencyRepository.save(record);
  }

  async markFailed(id: number, responseStatus: number, responseBody: unknown) {
    const record = await this.idempotencyRepository.findOne({ where: { id } });
    if (!record) return;
    record.status = IdempotencyStatus.FAILED;
    record.responseStatus = responseStatus;
    record.responseBody = (responseBody ?? null) as Record<string, unknown> | null;
    await this.idempotencyRepository.save(record);
  }
}
