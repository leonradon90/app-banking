import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { KycStatus } from './kyc-status.enum';

@Injectable()
export class KycService {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  async submit(userId: number, payload: Record<string, unknown>) {
    await this.auditService.record(`user_${userId}`, 'KYC_SUBMITTED', payload);
    // Emulate asynchronous verification by auto verifying.
    return this.authService.updateKycStatus(userId, KycStatus.REVIEW);
  }

  async updateStatus(userId: number, status: KycStatus) {
    const user = await this.authService.updateKycStatus(userId, status);
    await this.auditService.record('compliance', 'KYC_STATUS_UPDATED', {
      userId,
      status,
    });
    return user;
  }
}
