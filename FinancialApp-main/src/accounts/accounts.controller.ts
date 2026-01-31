import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { IsNumber, IsPositive } from 'class-validator';

class FundAccountDto {
  @IsNumber()
  @IsPositive()
  amount!: number;
}

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.userId, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.findById(id);
  }

  @Get()
  findMine(@CurrentUser() user: CurrentUserPayload) {
    return this.accountsService.findByUser(user.userId);
  }

  @Post(':id/fund')
  fundAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FundAccountDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.accountsService.fundAccount(id, dto.amount, `user_${user.userId}`);
  }
}
