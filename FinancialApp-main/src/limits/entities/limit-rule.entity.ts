import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum LimitScope {
  DAILY = 'DAILY',
  MONTHLY = 'MONTHLY',
  PER_TRANSACTION = 'PER_TRANSACTION',
}

@Entity({ name: 'limit_rules' })
export class LimitRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'account_id', nullable: true })
  accountId?: number;

  @Column({ name: 'user_id', nullable: true })
  userId?: number;

  @Column({ type: 'enum', enum: LimitScope })
  scope!: LimitScope;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  threshold!: string;

  @Column({ name: 'mcc', nullable: true })
  mcc?: number;

  @Column({ name: 'geo', nullable: true })
  geo?: string;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
