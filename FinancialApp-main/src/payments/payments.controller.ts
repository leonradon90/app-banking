import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
    @Headers('x-trace-id') traceIdHeader?: string,
  ) {
    if (idempotencyKeyHeader && dto.idempotencyKey !== idempotencyKeyHeader) {
      throw new BadRequestException('Idempotency-Key header must match idempotencyKey in body');
    }

    const actor = `user_${user.userId}`;
    const traceId = traceIdHeader ?? dto.traceId ?? dto.idempotencyKey;
    return this.paymentsService.createPayment({ ...dto, traceId }, actor, user.userId);
  }

  @Get('schedules')
  listSchedules(@CurrentUser() user: CurrentUserPayload) {
    return this.paymentsService.getSchedules(user.userId);
  }

  @Post('schedules/:id/cancel')
  cancelSchedule(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const actor = `user_${user.userId}`;
    return this.paymentsService.cancelSchedule(id, user.userId, actor);
  }
}
