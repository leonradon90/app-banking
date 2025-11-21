import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async record(actor: string, action: string, payload: Record<string, unknown>, traceId?: string) {
    const entry = this.auditRepository.create({ actor, action, payload, traceId });
    return this.auditRepository.save(entry);
  }
}
