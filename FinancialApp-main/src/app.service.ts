import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  getStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        kafka: {
          enabled: this.configService.get<boolean>('kafka.enabled') ?? true,
          brokers: this.configService.get<string[]>('kafka.brokers') ?? [],
        },
        notifications: {
          mode: this.configService.get<string>('notifications.mode') ?? 'stub',
          websocketEnabled:
            this.configService.get<boolean>('notifications.websocketEnabled') ?? true,
          kafkaConsumerEnabled:
            this.configService.get<boolean>('notifications.kafkaConsumerEnabled') ?? false,
        },
        webhooks: {
          enabled: this.configService.get<boolean>('webhooks.enabled') ?? false,
          url: this.configService.get<string>('webhooks.url') ?? '',
        },
        oauth: {
          mode: this.configService.get<string>('oauth.mode') ?? 'stub',
          provider: this.configService.get<string>('oauth.provider') ?? 'keycloak',
        },
        kyc: {
          providerMode: this.configService.get<string>('kyc.providerMode') ?? 'stub',
          providerName: this.configService.get<string>('kyc.providerName') ?? 'stub',
          storageMode: this.configService.get<string>('kyc.storageMode') ?? 'stub',
        },
        interbank: {
          mode: this.configService.get<string>('interbank.mode') ?? 'stub',
          provider: this.configService.get<string>('interbank.provider') ?? 'stub',
        },
        scheduler: {
          enabled: this.configService.get<boolean>('scheduler.enabled') ?? false,
        },
        audit: {
          wormMode: this.configService.get<string>('audit.wormMode') ?? 'stub',
          wormPath: this.configService.get<string>('audit.wormPath') ?? '',
        },
        cardVault: {
          mode: this.configService.get<string>('cardVault.mode') ?? 'stub',
        },
        observability: {
          metricsEnabled:
            this.configService.get<boolean>('observability.metricsEnabled') ?? true,
          traceEnabled:
            this.configService.get<boolean>('observability.traceEnabled') ?? true,
        },
        ledger: {
          eventSigningEnabled:
            this.configService.get<boolean>('ledger.eventSigningEnabled') ?? false,
        },
        security: {
          httpsEnabled: this.configService.get<boolean>('security.httpsEnabled') ?? false,
        },
        ha: {
          postgresReplicaEnabled:
            this.configService.get<boolean>('ha.postgresReplicaEnabled') ?? false,
          redisSentinelEnabled:
            this.configService.get<boolean>('ha.redisSentinelEnabled') ?? false,
          kafkaClusterBrokers: this.configService.get<string[]>('ha.kafkaClusterBrokers') ?? [],
        },
      },
    };
  }
}
