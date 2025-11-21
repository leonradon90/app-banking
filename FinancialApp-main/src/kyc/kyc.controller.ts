import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { KycStatus } from './kyc-status.enum';
import { IsEnum, IsNumber, IsString } from 'class-validator';

class SubmitKycDto {
  @IsString()
  documentType!: string;

  @IsString()
  documentNumber!: string;
}

class UpdateKycStatusDto {
  @IsNumber()
  userId!: number;

  @IsEnum(KycStatus)
  status!: KycStatus;
}

@ApiTags('kyc')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submit')
  submit(@CurrentUser() user: CurrentUserPayload, @Body() dto: SubmitKycDto) {
    return this.kycService.submit(user.userId, { ...dto });

  }

  @Patch('status')
  updateStatus(@Body() dto: UpdateKycStatusDto) {
    return this.kycService.updateStatus(dto.userId, dto.status);
  }
}
