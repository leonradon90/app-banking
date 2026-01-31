import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentSchedules1700000000005 implements MigrationInterface {
  name = 'AddPaymentSchedules1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE payment_schedule_status AS ENUM ('SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
    `);

    await queryRunner.query(`
      CREATE TABLE payment_schedules (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        actor VARCHAR(255) NOT NULL,
        status payment_schedule_status DEFAULT 'SCHEDULED',
        scheduled_for TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 3,
        last_error TEXT,
        ledger_entry_id INT,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_payment_schedules_status ON payment_schedules(status);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_payment_schedules_scheduled_for ON payment_schedules(scheduled_for);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payment_schedules_scheduled_for;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payment_schedules_status;`);
    await queryRunner.query(`DROP TABLE IF EXISTS payment_schedules;`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_schedule_status;`);
  }
}
