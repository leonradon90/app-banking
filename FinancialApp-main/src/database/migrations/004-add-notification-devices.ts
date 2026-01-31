import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationDevices1700000000003 implements MigrationInterface {
  name = 'AddNotificationDevices1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification_devices (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform VARCHAR(50) NOT NULL DEFAULT 'web',
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX notification_devices_unique_idx
      ON notification_devices (user_id, token);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS notification_devices_unique_idx`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_devices`);
  }
}
