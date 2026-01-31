import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

export type KycStoragePayload = {
  userId: number;
  documentType: string;
  fileContentBase64: string;
  fileName?: string;
};

@Injectable()
export class KycStorageService {
  private readonly logger = new Logger(KycStorageService.name);

  constructor(private readonly configService: ConfigService) {}

  async storeDocument(payload: KycStoragePayload) {
    const mode = this.configService.get<string>('kyc.storageMode') ?? 'stub';
    const basePath = this.configService.get<string>('kyc.storagePath') ?? 'storage/kyc';
    const baseUrl = this.configService.get<string>('kyc.storageBaseUrl') ?? 'stub://kyc';

    if (mode !== 'real') {
      const fileName = payload.fileName ?? `${payload.documentType}-${randomUUID()}.txt`;
      const targetDir = join(process.cwd(), basePath);
      await fs.mkdir(targetDir, { recursive: true });
      const targetPath = join(targetDir, fileName);
      const buffer = Buffer.from(this.normalizeBase64(payload.fileContentBase64), 'base64');
      await fs.writeFile(targetPath, buffer);

      this.logger.log(`Stubbed KYC document stored at ${targetPath}`);

      return {
        filePath: targetPath,
        fileUrl: `${baseUrl}/${fileName}`,
        mode: 'stub',
      };
    }

    return {
      filePath: '',
      fileUrl: `${baseUrl}/${payload.documentType}-${randomUUID()}`,
      mode: 'real',
      message: 'External object storage requires credentials.',
    };
  }

  private normalizeBase64(input: string) {
    const trimmed = input.trim();
    if (trimmed.startsWith('data:')) {
      const commaIndex = trimmed.indexOf(',');
      if (commaIndex >= 0) {
        return trimmed.slice(commaIndex + 1);
      }
      return trimmed.replace(/^data:[^;]+;base64,?/i, '');
    }
    return trimmed;
  }

  getStatus() {
    return {
      mode: this.configService.get<string>('kyc.storageMode') ?? 'stub',
      basePath: this.configService.get<string>('kyc.storagePath') ?? 'storage/kyc',
      baseUrl: this.configService.get<string>('kyc.storageBaseUrl') ?? 'stub://kyc',
    };
  }
}
