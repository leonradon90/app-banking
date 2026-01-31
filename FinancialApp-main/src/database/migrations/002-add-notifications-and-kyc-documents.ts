import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationsAndKycDocuments1700000000001 implements MigrationInterface {
  name = 'AddNotificationsAndKycDocuments1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE notification_type AS ENUM ('TRANSACTION', 'PAYMENT', 'CARD_CONTROL', 'KYC', 'LIMIT', 'SYSTEM');
    `);

    await queryRunner.query(`
      CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
    `);

    await queryRunner.query(`
      CREATE TYPE document_type AS ENUM ('PASSPORT', 'ID_CARD', 'DRIVER_LICENSE', 'UTILITY_BILL', 'BANK_STATEMENT', 'PROOF_OF_ADDRESS');
    `);

    await queryRunner.query(`
      CREATE TYPE document_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVIEW');
    `);

    await queryRunner.query(`
      CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        type notification_type NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB,
        status notification_status DEFAULT 'PENDING',
        channels JSONB,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_user_id ON notifications(user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_status ON notifications(status);
    `);

    await queryRunner.query(`
      CREATE TABLE kyc_documents (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        document_type document_type NOT NULL,
        status document_status DEFAULT 'PENDING',
        document_number VARCHAR(255),
        file_url VARCHAR(512),
        file_path VARCHAR(512),
        expiry_date DATE,
        metadata JSONB,
        rejection_reason TEXT,
        reviewed_by VARCHAR(255),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_kyc_documents_user_id ON kyc_documents(user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_kyc_documents_status ON kyc_documents(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_kyc_documents_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_kyc_documents_user_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_user_id;`);

    await queryRunner.query(`DROP TABLE IF EXISTS kyc_documents;`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications;`);

    await queryRunner.query(`DROP TYPE IF EXISTS document_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS document_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS notification_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS notification_type;`);
  }
}

