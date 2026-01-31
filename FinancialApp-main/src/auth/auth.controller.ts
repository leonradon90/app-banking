import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../common/guards/jwt-refresh.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Request } from 'express';
import { OAuthService } from './oauth.service';
import { IsOptional, IsString } from 'class-validator';

class OAuthTokenDto {
  @IsString()
  email!: string;

  @IsString()
  externalToken!: string;

  @IsOptional()
  @IsString()
  provider?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Body() _dto: LoginDto, @Req() req: Request) {
    const user = req.user as { id: number };
    return this.authService.login(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: CurrentUserPayload) {
    return user;
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refresh(@Body() _dto: RefreshTokenDto, @CurrentUser() user: CurrentUserPayload) {
    return this.authService.refresh(user.userId);
  }

  @Get('oauth/status')
  oauthStatus() {
    return this.oauthService.getStatus();
  }

  @Post('oauth/token')
  oauthToken(@Body() dto: OAuthTokenDto) {
    return this.oauthService.exchangeToken(dto);
  }
}
