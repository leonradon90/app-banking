import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { KycDocument } from './entities/kyc-document.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KycProviderService } from './kyc-provider.service';
import { KycStorageService } from './kyc-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycDocument]),
    AuthModule,
    AuditModule,
    NotificationsModule,
  ],
  providers: [KycService, KycProviderService, KycStorageService],
  controllers: [KycController],
})
export class KycModule {}
