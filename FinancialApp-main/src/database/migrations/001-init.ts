import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitMigration0011700000000000 implements MigrationInterface {
  name = 'InitMigration0011700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE kyc_status AS ENUM ('PENDING','VERIFIED','REJECTED','REVIEW');
    `);
    await queryRunner.query(`
      CREATE TYPE account_status AS ENUM ('ACTIVE','FROZEN','CLOSED');
    `);
    await queryRunner.query(`
      CREATE TYPE card_status AS ENUM ('ACTIVE','FROZEN');
    `);
    await queryRunner.query(`
      CREATE TYPE limit_scope AS ENUM ('DAILY','MONTHLY','PER_TRANSACTION');
    `);
    await queryRunner.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        kyc_status kyc_status DEFAULT 'PENDING',
        roles TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE TABLE accounts (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        currency VARCHAR(3) DEFAULT 'USD',
        balance NUMERIC(14,2) DEFAULT 0,
        status account_status DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        version INT DEFAULT 1
      );
    `);
    await queryRunner.query(`
      CREATE TABLE ledger_entries (
        id SERIAL PRIMARY KEY,
        debit_account INT REFERENCES accounts(id) ON DELETE RESTRICT,
        credit_account INT REFERENCES accounts(id) ON DELETE RESTRICT,
        amount NUMERIC(14,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        idempotency_key UUID UNIQUE NOT NULL,
        trace_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE TABLE audit_log (
        id SERIAL PRIMARY KEY,
        actor VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        trace_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE TABLE notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        channels JSONB DEFAULT '{}'::jsonb,
        event_preferences JSONB DEFAULT '{}'::jsonb
      );
    `);
    await queryRunner.query(`
      CREATE TABLE card_controls (
        id SERIAL PRIMARY KEY,
        account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
        card_token VARCHAR(255) UNIQUE NOT NULL,
        status card_status DEFAULT 'ACTIVE',
        mcc_whitelist JSONB DEFAULT '[]'::jsonb,
        geo_whitelist JSONB DEFAULT '[]'::jsonb,
        spend_limits JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE TABLE limit_rules (
        id SERIAL PRIMARY KEY,
        account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        scope limit_scope NOT NULL,
        threshold NUMERIC(14,2) NOT NULL,
        mcc INT,
        geo VARCHAR(10),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Создание индексов для улучшения производительности
    await queryRunner.query(`
      CREATE INDEX idx_accounts_user_id ON accounts(user_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ledger_entries_debit_account ON ledger_entries(debit_account);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ledger_entries_credit_account ON ledger_entries(credit_account);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ledger_entries_idempotency_key ON ledger_entries(idempotency_key);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ledger_entries_trace_id ON ledger_entries(trace_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_ledger_entries_created_at ON ledger_entries(created_at);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_audit_log_actor ON audit_log(actor);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_audit_log_action ON audit_log(action);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_card_controls_account_id ON card_controls(account_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_card_controls_card_token ON card_controls(card_token);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_limit_rules_account_id ON limit_rules(account_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_limit_rules_user_id ON limit_rules(user_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_limit_rules_active ON limit_rules(active);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE limit_rules');
    await queryRunner.query('DROP TABLE card_controls');
    await queryRunner.query('DROP TABLE notification_preferences');
    await queryRunner.query('DROP TABLE audit_log');
    await queryRunner.query('DROP TABLE ledger_entries');
    await queryRunner.query('DROP TABLE accounts');
    await queryRunner.query('DROP TABLE users');
    await queryRunner.query('DROP TYPE limit_scope');
    await queryRunner.query('DROP TYPE card_status');
    await queryRunner.query('DROP TYPE account_status');
    await queryRunner.query('DROP TYPE kyc_status');
  }
}
