import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { KycDocument } from './entities/kyc-document.entity';
import { KycProviderService } from './kyc-provider.service';
import { KycStorageService } from './kyc-storage.service';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [TypeOrmModule.forFeature([KycDocument]), AuthModule, AuditModule, NotificationsModule],
  providers: [KycService, KycProviderService, KycStorageService],
  controllers: [KycController],
})
export class KycModule {}
