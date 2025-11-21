import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 50 })
  actor!: string;

  @Column({ length: 50 })
  action!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'trace_id', nullable: true })
  traceId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
