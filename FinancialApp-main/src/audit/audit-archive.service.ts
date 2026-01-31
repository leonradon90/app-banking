import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditArchiveService {
  private readonly logger = new Logger(AuditArchiveService.name);

  constructor(private readonly configService: ConfigService) {}

  async append(entry: AuditLog) {
    const mode = this.configService.get<string>('audit.wormMode') ?? 'stub';
    if (mode === 'off') return;

    const archivePath =
      this.configService.get<string>('audit.wormPath') ?? 'storage/audit_worm.log';
    const fullPath = join(process.cwd(), archivePath);

    try {
      await fs.mkdir(dirname(fullPath), { recursive: true });
      await fs.appendFile(fullPath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit archive append failed: ${message}`);
    }
  }
}
