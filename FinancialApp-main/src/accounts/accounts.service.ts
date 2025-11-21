import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account, AccountStatus } from './entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
  ) {}

  async create(userId: number, dto: CreateAccountDto) {
    const initialBalance = dto.initialBalance ?? 0;
    const account = this.accountsRepository.create({
      userId,
      currency: dto.currency,
      status: AccountStatus.ACTIVE,
      balance: initialBalance.toFixed(2),
    });
    return this.accountsRepository.save(account);
  }

  async findById(id: number) {
    const account = await this.accountsRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async findByUser(userId: number) {
    return this.accountsRepository.find({ where: { userId } });
  }
}
