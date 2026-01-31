import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdempotencyKeys1700000000002 implements MigrationInterface {
  name = 'AddIdempotencyKeys1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE idempotency_keys (
        id SERIAL PRIMARY KEY,
        idempotency_key UUID NOT NULL,
        endpoint TEXT NOT NULL,
        scope TEXT,
        request_hash TEXT NOT NULL,
        response_status INT,
        response_body JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idempotency_keys_unique_idx
      ON idempotency_keys (idempotency_key, endpoint, scope);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idempotency_keys_unique_idx`);
    await queryRunner.query(`DROP TABLE IF EXISTS idempotency_keys`);
  }
}
