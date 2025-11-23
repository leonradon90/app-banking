import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { User } from '../../auth/entities/user.entity';

export enum LimitScope {
  DAILY = 'DAILY',
  MONTHLY = 'MONTHLY',
  PER_TRANSACTION = 'PER_TRANSACTION',
}

@Entity({ name: 'limit_rules' })
export class LimitRule {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({ name: 'account_id', nullable: true })
  accountId?: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

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
