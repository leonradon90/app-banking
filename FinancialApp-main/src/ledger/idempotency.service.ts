import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LedgerEntry } from './entities/ledger-entry.entity';

export interface IdempotencyResult<T> {
  isDuplicate: boolean;
  result?: T;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async checkIdempotency(
    idempotencyKey: string,
  ): Promise<IdempotencyResult<LedgerEntry>> {
    const existing = await this.ledgerRepository.findOne({
      where: { idempotencyKey },
    });

    if (existing) {
      return {
        isDuplicate: true,
        result: existing,
      };
    }

    return {
      isDuplicate: false,
    };
  }

  async checkIdempotencyInTransaction(
    idempotencyKey: string,
    manager: any,
  ): Promise<IdempotencyResult<LedgerEntry>> {
    const existing = await manager.findOne(LedgerEntry, {
      where: { idempotencyKey },
    });

    if (existing) {
      return {
        isDuplicate: true,
        result: existing,
      };
    }

    return {
      isDuplicate: false,
    };
  }

  validateIdempotencyKey(key: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(key);
  }
}

