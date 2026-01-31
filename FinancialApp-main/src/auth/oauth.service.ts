import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';
import { KycStatus } from '../kyc/kyc-status.enum';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

export type OAuthExchangeRequest = {
  email: string;
  externalToken: string;
  provider?: string;
};

@Injectable()
export class OAuthService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  getStatus() {
    return {
      mode: this.configService.get<string>('oauth.mode') ?? 'stub',
      provider: this.configService.get<string>('oauth.provider') ?? 'keycloak',
      tokenUrl: this.configService.get<string>('oauth.tokenUrl') ?? '',
      configured: Boolean(
        this.configService.get<string>('oauth.clientId') &&
          this.configService.get<string>('oauth.clientSecret'),
      ),
    };
  }

  async exchangeToken(payload: OAuthExchangeRequest) {
    const mode = this.configService.get<string>('oauth.mode') ?? 'stub';

    if (mode !== 'real') {
      const email = payload.email.toLowerCase();
      let user = await this.usersRepository.findOne({ where: { email } });
      if (!user) {
        const passwordHash = await bcrypt.hash(randomUUID(), 10);
        user = this.usersRepository.create({
          email,
          passwordHash,
          kycStatus: KycStatus.PENDING,
          roles: ['customer'],
        });
        user = await this.usersRepository.save(user);
      }

      return {
        ...(await this.authService.login(user.id)),
        provider: payload.provider ?? 'stub',
        mode: 'stub',
      };
    }

    return {
      mode: 'real',
      message: 'OAuth provider integration requires external infrastructure.',
    };
  }
}
