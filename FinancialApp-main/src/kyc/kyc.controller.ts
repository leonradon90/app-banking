import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { KycStatus } from './kyc-status.enum';
import { DocumentType, DocumentStatus } from './entities/kyc-document.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';

class SubmitKycDto {
  @IsString()
  documentType!: string;

  @IsString()
  documentNumber!: string;
}

class SubmitKycDocumentDto {
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  filePath?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  fileContentBase64?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}

class UpdateKycStatusDto {
  @IsNumber()
  userId!: number;

  @IsEnum(KycStatus)
  status!: KycStatus;
}

class UpdateKycDocumentStatusDto {
  @IsEnum(DocumentStatus)
  status!: DocumentStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;
}

@ApiTags('kyc')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get KYC status and documents for current user' })
  @ApiResponse({ status: 200, description: 'KYC status and documents' })
  getStatus(@CurrentUser() user: CurrentUserPayload) {
    return this.kycService.getStatus(user.userId);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Get all KYC documents for current user' })
  @ApiResponse({ status: 200, description: 'List of KYC documents' })
  getDocuments(@CurrentUser() user: CurrentUserPayload) {
    return this.kycService.getDocuments(user.userId);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get KYC document by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'KYC document found' })
  @ApiResponse({ status: 404, description: 'KYC document not found' })
  getDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.kycService.getDocumentById(id, user.userId);
  }

  @Get('integrations/status')
  @ApiOperation({ summary: 'Get KYC integration status (provider/storage)' })
  @ApiResponse({ status: 200, description: 'KYC integration status' })
  getIntegrationsStatus() {
    return this.kycService.getIntegrationsStatus();
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit KYC information (legacy)' })
  @ApiResponse({ status: 200, description: 'KYC submitted' })
  submit(@CurrentUser() user: CurrentUserPayload, @Body() dto: SubmitKycDto) {
    return this.kycService.submit(user.userId, { ...dto });
  }

  @Post('documents')
  @ApiOperation({ summary: 'Submit KYC document' })
  @ApiResponse({ status: 201, description: 'Document submitted' })
  submitDocument(@CurrentUser() user: CurrentUserPayload, @Body() dto: SubmitKycDocumentDto) {
    return this.kycService.submitDocument(user.userId, {
      ...dto,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
    });
  }

  @Patch('documents/:id/status')
  @ApiOperation({ summary: 'Update KYC document status (admin only)' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Document status updated' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @Roles('admin', 'compliance')
  @UseGuards(RolesGuard)
  updateDocumentStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKycDocumentStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.kycService.updateDocumentStatus(id, dto, `user_${user.userId}`);
  }

  @Patch('status')
  @ApiOperation({ summary: 'Update KYC status (admin only)' })
  @ApiResponse({ status: 200, description: 'KYC status updated' })
  @Roles('admin', 'compliance')
  @UseGuards(RolesGuard)
  updateStatus(
    @Body() dto: UpdateKycStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.kycService.updateStatus(dto.userId, dto.status, `user_${user.userId}`);
  }
}
