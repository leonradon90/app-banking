import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { KycStatus } from '../../kyc/kyc-status.enum';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'kyc_status', type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  kycStatus!: KycStatus;

  @Column({ type: 'simple-array', default: 'customer' })
  roles!: string[];

  @OneToMany(() => Account, (account) => account.user)
  accounts!: Account[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
