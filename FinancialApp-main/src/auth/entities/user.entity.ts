import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { KycStatus } from '../../kyc/kyc-status.enum';
import { LimitRule } from '../../limits/entities/limit-rule.entity';
import { NotificationPreference } from '../../notifications/entities/notification-preference.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  kycStatus!: KycStatus;

  @Column({ type: 'simple-array', default: 'customer' })
  roles!: string[];

  @OneToMany(() => Account, (account) => account.user)
  accounts!: Account[];

  @OneToMany(() => LimitRule, (limitRule) => limitRule.user)
  limitRules!: LimitRule[];

  @OneToOne(() => NotificationPreference, (preference) => preference.user)
  notificationPreference?: NotificationPreference;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
