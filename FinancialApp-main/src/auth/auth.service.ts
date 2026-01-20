import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { KycStatus } from '../kyc/kyc-status.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      kycStatus: KycStatus.PENDING,
      roles: ['customer'],
    });
    await this.usersRepository.save(user);
    return this.generateTokens(user);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.usersRepository.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.generateTokens(user);
  }

  async refresh(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.generateTokens(user);
  }

  async updateKycStatus(userId: number, status: KycStatus) {
    await this.usersRepository.update({ id: userId }, { kycStatus: status });
    return this.usersRepository.findOne({ where: { id: userId } });
  }

  async getUserById(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, roles: user.roles, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('auth.refreshSecret'),
      expiresIn: this.configService.get<string>('auth.refreshExpiresIn'),
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        kycStatus: user.kycStatus,
        roles: user.roles,
      },
    };
  }
}
