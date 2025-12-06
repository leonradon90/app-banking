import 'reflect-metadata';
import { DataSource } from 'typeorm';
import configuration from '../common/config/configuration';
import { InitMigration0011700000000000 } from './migrations/001-init';

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
  migrations: [InitMigration0011700000000000],
});
