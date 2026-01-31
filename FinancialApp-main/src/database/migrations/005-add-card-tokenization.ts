import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCardTokenization1700000000004 implements MigrationInterface {
  name = 'AddCardTokenization1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE card_controls
      ADD COLUMN pan_last4 VARCHAR(4),
      ADD COLUMN pan_encrypted TEXT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE card_controls
      DROP COLUMN IF EXISTS pan_last4,
      DROP COLUMN IF EXISTS pan_encrypted;
    `);
  }
}
