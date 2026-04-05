import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditArchiveService } from './audit-archive.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { AuditLog } from './entities/audit-log.entity';

export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditAccessScope {
  actor?: string;
  privileged?: boolean;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    private readonly auditArchiveService: AuditArchiveService,
  ) {}

  async record(
    actor: string,
    action: string,
    payload: Record<string, unknown>,
    traceId?: string,
  ): Promise<AuditLog> {
    const entry = this.auditRepository.create({ actor, action, payload, traceId });
    const saved = await this.auditRepository.save(entry);
    await this.auditArchiveService.append(saved);
    return saved;
  }

  async findLogs(query: QueryAuditLogDto, scope?: AuditAccessScope): Promise<PaginatedAuditLogs> {
    const { actor, action, traceId, startDate, endDate, page = 1, limit = 20 } = query;
    const actorFilter = scope?.privileged ? actor : scope?.actor;

    const queryBuilder = this.auditRepository.createQueryBuilder('audit_log');

    if (actorFilter) {
      queryBuilder.andWhere('audit_log.actor = :actor', { actor: actorFilter });
    }

    if (action) {
      queryBuilder.andWhere('audit_log.action = :action', { action });
    }

    if (traceId) {
      queryBuilder.andWhere('audit_log.trace_id = :traceId', { traceId });
    }

    if (startDate) {
      queryBuilder.andWhere('audit_log.created_at >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      queryBuilder.andWhere('audit_log.created_at <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    const total = await queryBuilder.getCount();

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    queryBuilder.orderBy('audit_log.created_at', 'DESC');

    const data = await queryBuilder.getMany();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findLogsByTraceId(traceId: string, scope?: AuditAccessScope): Promise<AuditLog[]> {
    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit_log')
      .where('audit_log.trace_id = :traceId', { traceId })
      .orderBy('audit_log.created_at', 'DESC');

    if (!scope?.privileged && scope?.actor) {
      queryBuilder.andWhere('audit_log.actor = :actor', { actor: scope.actor });
    }

    return queryBuilder.getMany();
  }

  async findById(id: number, scope?: AuditAccessScope): Promise<AuditLog> {
    const log = await this.auditRepository.findOne({ where: { id } });

    if (!log) {
      throw new NotFoundException(`Audit log with ID ${id} not found`);
    }

    if (!scope?.privileged && scope?.actor && log.actor !== scope.actor) {
      throw new ForbiddenException('You do not have access to this audit entry');
    }

    return log;
  }

  async getActionStats(
    startDate?: Date,
    endDate?: Date,
    scope?: AuditAccessScope,
  ): Promise<
    Array<{
      action: string;
      count: number;
    }>
  > {
    const queryBuilder = this.auditRepository
      .createQueryBuilder('audit_log')
      .select('audit_log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit_log.action');

    if (!scope?.privileged && scope?.actor) {
      queryBuilder.andWhere('audit_log.actor = :actor', { actor: scope.actor });
    }

    if (startDate) {
      queryBuilder.andWhere('audit_log.created_at >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('audit_log.created_at <= :endDate', { endDate });
    }

    const results = await queryBuilder.getRawMany();

    return results.map((r) => ({
      action: r.action,
      count: parseInt(r.count, 10),
    }));
  }
}
