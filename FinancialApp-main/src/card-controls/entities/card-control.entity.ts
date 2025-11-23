import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';

export enum CardStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
}

@Entity({ name: 'card_controls' })
export class CardControl {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Account, { nullable: false })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @Column({ name: 'account_id' })
  accountId!: number;

  @Column({ name: 'card_token', unique: true })
  cardToken!: string;

  @Column({ type: 'enum', enum: CardStatus, default: CardStatus.ACTIVE })
  status!: CardStatus;

  @Column({ type: 'jsonb', name: 'mcc_whitelist', default: () => "'[]'" })
  mccWhitelist!: number[];

  @Column({ type: 'jsonb', name: 'geo_whitelist', default: () => "'[]'" })
  geoWhitelist!: string[];

  @Column({ type: 'jsonb', name: 'spend_limits', default: () => "'{}'" })
  spendLimits!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
