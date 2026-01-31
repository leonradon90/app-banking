export default () => ({
  app: {
    port: parseInt(process.env.APP_PORT ?? '3000', 10),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-too',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    username: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.POSTGRES_DB ?? 'financial_app',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID ?? 'financial-app',
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    enabled: process.env.KAFKA_ENABLED !== 'false',
  },
  notifications: {
    mode: process.env.NOTIFICATIONS_MODE ?? 'stub',
    websocketEnabled: process.env.WEBSOCKET_ENABLED !== 'false',
    websocketCorsOrigin: process.env.WEBSOCKET_CORS_ORIGIN ?? '*',
    kafkaConsumerEnabled: process.env.NOTIFICATIONS_KAFKA_CONSUMER_ENABLED === 'true',
    kafkaConsumerGroupId:
      process.env.NOTIFICATIONS_KAFKA_CONSUMER_GROUP_ID ?? 'financial-app-notifications',
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID ?? '',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
      privateKey: process.env.FIREBASE_PRIVATE_KEY ?? '',
      appId: process.env.FIREBASE_APP_ID ?? '',
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY ?? '',
      fromEmail: process.env.SENDGRID_FROM_EMAIL ?? '',
      fromName: process.env.SENDGRID_FROM_NAME ?? 'ALTX Finance',
    },
  },
  webhooks: {
    enabled: process.env.WEBHOOK_ENABLED === 'true',
    url: process.env.WEBHOOK_URL ?? '',
    secret: process.env.WEBHOOK_SECRET ?? '',
  },
  oauth: {
    mode: process.env.OAUTH_MODE ?? 'stub',
    provider: process.env.OAUTH_PROVIDER ?? 'keycloak',
    tokenUrl: process.env.OAUTH_TOKEN_URL ?? '',
    clientId: process.env.OAUTH_CLIENT_ID ?? '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET ?? '',
  },
  kyc: {
    providerMode: process.env.KYC_PROVIDER_MODE ?? 'stub',
    providerName: process.env.KYC_PROVIDER_NAME ?? 'stub',
    storageMode: process.env.KYC_STORAGE_MODE ?? 'stub',
    storagePath: process.env.KYC_STORAGE_PATH ?? 'storage/kyc',
    storageBaseUrl: process.env.KYC_STORAGE_BASE_URL ?? 'stub://kyc',
  },
  interbank: {
    mode: process.env.INTERBANK_MODE ?? 'stub',
    provider: process.env.INTERBANK_PROVIDER ?? 'stub',
    endpoint: process.env.INTERBANK_ENDPOINT ?? '',
    apiKey: process.env.INTERBANK_API_KEY ?? '',
    retryMaxAttempts: parseInt(process.env.INTERBANK_RETRY_MAX_ATTEMPTS ?? '3', 10),
    retryBackoffMs: parseInt(process.env.INTERBANK_RETRY_BACKOFF_MS ?? '250', 10),
    stubFailureRate: process.env.INTERBANK_STUB_FAILURE_RATE ?? '0',
  },
  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED === 'true',
    pollIntervalMs: parseInt(process.env.SCHEDULER_POLL_INTERVAL_MS ?? '30000', 10),
    retryBackoffMs: parseInt(process.env.SCHEDULER_RETRY_BACKOFF_MS ?? '60000', 10),
    maxAttempts: parseInt(process.env.SCHEDULER_MAX_ATTEMPTS ?? '3', 10),
  },
  audit: {
    wormMode: process.env.AUDIT_WORM_MODE ?? 'stub',
    wormPath: process.env.AUDIT_WORM_PATH ?? 'storage/audit_worm.log',
  },
  cardVault: {
    mode: process.env.CARD_VAULT_MODE ?? 'stub',
    tokenizationSecret: process.env.CARD_TOKENIZATION_SECRET ?? 'stub-token',
    encryptionKey: process.env.CARD_ENCRYPTION_KEY ?? '',
  },
  observability: {
    metricsEnabled: process.env.METRICS_ENABLED !== 'false',
    traceEnabled: process.env.TRACING_ENABLED !== 'false',
  },
  security: {
    httpsEnabled: process.env.HTTPS_ENABLED === 'true',
    httpsKeyPath: process.env.HTTPS_KEY_PATH ?? '',
    httpsCertPath: process.env.HTTPS_CERT_PATH ?? '',
    httpsCaPath: process.env.HTTPS_CA_PATH ?? '',
  },
  ledger: {
    eventSigningEnabled: process.env.LEDGER_EVENT_SIGNING_ENABLED === 'true',
    eventSigningSecret: process.env.LEDGER_EVENT_HMAC_SECRET ?? '',
  },
  ha: {
    postgresReplicaEnabled: process.env.POSTGRES_REPLICA_ENABLED === 'true',
    redisSentinelEnabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
    kafkaClusterBrokers: (process.env.KAFKA_CLUSTER_BROKERS ?? '')
      .split(',')
      .filter(Boolean),
  },
});
