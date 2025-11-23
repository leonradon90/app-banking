import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { LedgerEntry } from '../../ledger/entities/ledger-entry.entity';
import { CardControl } from '../../card-controls/entities/card-control.entity';
import { LimitRule } from '../../limits/entities/limit-rule.entity';

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

@Entity({ name: 'accounts' })
export class Account {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (user) => user.accounts, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  balance!: string;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status!: AccountStatus;

  @OneToMany(() => LedgerEntry, (entry) => entry.debitAccount)
  debitEntries!: LedgerEntry[];

  @OneToMany(() => LedgerEntry, (entry) => entry.creditAccount)
  creditEntries!: LedgerEntry[];

  @OneToMany(() => CardControl, (cardControl) => cardControl.account)
  cardControls!: CardControl[];

  @OneToMany(() => LimitRule, (limitRule) => limitRule.account)
  limitRules!: LimitRule[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version!: number;
}
