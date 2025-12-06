import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface PaginatedAuditLogs {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async record(
    actor: string,
    action: string,
    payload: Record<string, unknown>,
    traceId?: string,
  ): Promise<AuditLog> {
    const entry = this.auditRepository.create({ actor, action, payload, traceId });
    return this.auditRepository.save(entry);
  }

  async findLogs(query: QueryAuditLogDto): Promise<PaginatedAuditLogs> {
    const {
      actor,
      action,
      traceId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const where: FindOptionsWhere<AuditLog> = {};

    if (actor) {
      where.actor = actor;
    }

    if (action) {
      where.action = action;
    }

    if (traceId) {
      where.traceId = traceId;
    }

    const queryBuilder = this.auditRepository.createQueryBuilder('audit_log');

    if (actor) {
      queryBuilder.andWhere('audit_log.actor = :actor', { actor });
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

  async findLogsByTraceId(traceId: string): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { traceId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<AuditLog> {
    const log = await this.auditRepository.findOne({ where: { id } });

    if (!log) {
      throw new NotFoundException(`Audit log with ID ${id} not found`);
    }

    return log;
  }

  async getActionStats(startDate?: Date, endDate?: Date): Promise<
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
