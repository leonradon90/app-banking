import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { KycStatus } from './kyc-status.enum';
import { KycDocument, DocumentType, DocumentStatus } from './entities/kyc-document.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { KycProviderService } from './kyc-provider.service';
import { KycStorageService } from './kyc-storage.service';

export interface SubmitKycDocumentDto {
  documentType: DocumentType;
  documentNumber?: string;
  fileUrl?: string;
  filePath?: string;
  fileContentBase64?: string;
  fileName?: string;
  expiryDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface UpdateKycDocumentStatusDto {
  status: DocumentStatus;
  rejectionReason?: string;
  reviewedBy?: string;
}

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycDocument)
    private readonly kycDocumentRepository: Repository<KycDocument>,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly kycProviderService: KycProviderService,
    private readonly kycStorageService: KycStorageService,
  ) {}

  async submit(userId: number, payload: Record<string, unknown>) {
    await this.auditService.record(`user_${userId}`, 'KYC_SUBMITTED', payload);
    const user = await this.authService.updateKycStatus(userId, KycStatus.REVIEW);

    try {
      await this.notificationsService.createNotification({
        userId,
        type: NotificationType.KYC,
        title: 'KYC Submission Received',
        message: 'Your KYC documents have been submitted and are under review',
        metadata: { status: KycStatus.REVIEW },
      });
    } catch (error) {
      // Log but don't fail if notification fails
    }

    return user;
  }

  async submitDocument(userId: number, dto: SubmitKycDocumentDto): Promise<KycDocument> {
    let fileUrl = dto.fileUrl;
    let filePath = dto.filePath;

    if (dto.fileContentBase64) {
      const stored = await this.kycStorageService.storeDocument({
        userId,
        documentType: dto.documentType,
        fileContentBase64: dto.fileContentBase64,
        fileName: dto.fileName,
      });
      fileUrl = stored.fileUrl;
      filePath = stored.filePath;
    }

    const providerResult = await this.kycProviderService.submitDocument({
      userId,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      fileUrl,
      filePath,
      metadata: dto.metadata,
    });

    const document = this.kycDocumentRepository.create({
      userId,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      fileUrl,
      filePath,
      expiryDate: dto.expiryDate,
      metadata: {
        ...(dto.metadata ?? {}),
        provider: providerResult,
      },
      status: DocumentStatus.PENDING,
    });

    const saved = await this.kycDocumentRepository.save(document);

    await this.auditService.record(`user_${userId}`, 'KYC_DOCUMENT_SUBMITTED', {
      documentId: saved.id,
      documentType: dto.documentType,
    });

    const requiredDocuments = [DocumentType.PASSPORT, DocumentType.ID_CARD];
    if (requiredDocuments.includes(dto.documentType)) {
      await this.authService.updateKycStatus(userId, KycStatus.REVIEW);
    }

    return saved;
  }

  async getDocuments(userId: number): Promise<KycDocument[]> {
    return this.kycDocumentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getDocumentById(id: number, userId?: number): Promise<KycDocument> {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }

    const document = await this.kycDocumentRepository.findOne({ where });

    if (!document) {
      throw new NotFoundException(`KYC document with ID ${id} not found`);
    }

    return document;
  }

  async updateDocumentStatus(
    documentId: number,
    dto: UpdateKycDocumentStatusDto,
    reviewer: string,
  ): Promise<KycDocument> {
    const document = await this.getDocumentById(documentId);

    document.status = dto.status;
    document.reviewedBy = reviewer || dto.reviewedBy;
    document.reviewedAt = new Date();

    if (dto.status === DocumentStatus.REJECTED && dto.rejectionReason) {
      document.rejectionReason = dto.rejectionReason;
    }

    const saved = await this.kycDocumentRepository.save(document);

    await this.auditService.record(reviewer, 'KYC_DOCUMENT_STATUS_UPDATED', {
      documentId: saved.id,
      status: dto.status,
      userId: document.userId,
    });

    if (dto.status === DocumentStatus.APPROVED) {
      await this.checkAndUpdateKycStatus(document.userId);
    } else if (dto.status === DocumentStatus.REJECTED) {
      await this.authService.updateKycStatus(document.userId, KycStatus.REJECTED);

      try {
        await this.notificationsService.createNotification({
          userId: document.userId,
          type: NotificationType.KYC,
          title: 'KYC Document Rejected',
          message: `Your ${document.documentType} document was rejected. Reason: ${dto.rejectionReason}`,
          metadata: { documentId: saved.id, status: DocumentStatus.REJECTED },
        });
      } catch (error) {
        // Log but don't fail
      }
    }

    return saved;
  }

  private async checkAndUpdateKycStatus(userId: number): Promise<void> {
    const documents = await this.getDocuments(userId);
    const requiredDocuments = [DocumentType.PASSPORT, DocumentType.ID_CARD];

    const hasAllRequired = requiredDocuments.every((requiredType) => {
      return documents.some(
        (doc) =>
          doc.documentType === requiredType && doc.status === DocumentStatus.APPROVED,
      );
    });

    if (hasAllRequired) {
      const user = await this.authService.updateKycStatus(userId, KycStatus.VERIFIED);
      await this.auditService.record('system', 'KYC_VERIFIED', { userId });

      try {
        await this.notificationsService.createNotification({
          userId,
          type: NotificationType.KYC,
          title: 'KYC Verified',
          message: 'Your KYC verification has been completed successfully',
          metadata: { status: KycStatus.VERIFIED },
        });
      } catch (error) {
        // Log but don't fail
      }
    }
  }

  async getStatus(userId: number) {
    const documents = await this.getDocuments(userId);
    
    const user = await this.authService.getUserById(userId);
    
    return {
      userId,
      status: user.kycStatus,
      documents: documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        status: doc.status,
        createdAt: doc.createdAt,
        reviewedAt: doc.reviewedAt,
        rejectionReason: doc.rejectionReason,
      })),
      documentsCount: documents.length,
      approvedCount: documents.filter((d) => d.status === DocumentStatus.APPROVED).length,
      pendingCount: documents.filter((d) => d.status === DocumentStatus.PENDING).length,
      rejectedCount: documents.filter((d) => d.status === DocumentStatus.REJECTED).length,
    };
  }

  async updateStatus(userId: number, status: KycStatus, updatedBy?: string) {
    const user = await this.authService.updateKycStatus(userId, status);
    await this.auditService.record(updatedBy || 'compliance', 'KYC_STATUS_UPDATED', {
      userId,
      status,
    });

    try {
      await this.notificationsService.createNotification({
        userId,
        type: NotificationType.KYC,
        title: `KYC Status Updated: ${status}`,
        message: `Your KYC status has been updated to ${status}`,
        metadata: { status },
      });
    } catch (error) {
      // Log but don't fail
    }

    return user;
  }

  getIntegrationsStatus() {
    return {
      provider: this.kycProviderService.getStatus(),
      storage: this.kycStorageService.getStatus(),
    };
  }
}
