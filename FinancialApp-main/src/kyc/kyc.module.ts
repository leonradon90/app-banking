import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { KycDocument } from './entities/kyc-document.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycDocument]),
    AuthModule,
    AuditModule,
    NotificationsModule,
  ],
  providers: [KycService],
  controllers: [KycController],
})
export class KycModule {}
