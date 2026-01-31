import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import configuration from '../common/config/configuration';
import { InitMigration0011700000000000 } from './migrations/001-init';
import { AddNotificationsAndKycDocuments1700000000001 } from './migrations/002-add-notifications-and-kyc-documents';
import { AddIdempotencyKeys1700000000002 } from './migrations/003-add-idempotency-keys';
import { AddNotificationDevices1700000000003 } from './migrations/004-add-notification-devices';
import { AddCardTokenization1700000000004 } from './migrations/005-add-card-tokenization';
import { AddPaymentSchedules1700000000005 } from './migrations/006-add-payment-schedules';

const config = configuration();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? config.postgres.host,
  port: Number(process.env.POSTGRES_PORT ?? config.postgres.port),
  username: process.env.POSTGRES_USER ?? config.postgres.username,
  password: process.env.POSTGRES_PASSWORD ?? config.postgres.password,
  database: process.env.POSTGRES_DB ?? config.postgres.database,
  synchronize: false,
  logging: false,
  entities: ['dist/**/*.entity.js', 'src/**/*.entity.ts'],
  migrations: [
    InitMigration0011700000000000,
    AddNotificationsAndKycDocuments1700000000001,
    AddIdempotencyKeys1700000000002,
    AddNotificationDevices1700000000003,
    AddCardTokenization1700000000004,
    AddPaymentSchedules1700000000005,
  ],
});
