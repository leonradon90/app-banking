import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';

@Entity({ name: 'ledger_entries' })
export class LedgerEntry {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Account, (account) => account.debitEntries, { nullable: false })
  @JoinColumn({ name: 'debit_account' })
  debitAccount!: Account;

  @Column({ name: 'debit_account' })
  debitAccountId!: number;

  @ManyToOne(() => Account, (account) => account.creditEntries, {
    nullable: false,
  })
  @JoinColumn({ name: 'credit_account' })
  creditAccount!: Account;

  @Column({ name: 'credit_account' })
  creditAccountId!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Column({ length: 3 })
  currency!: string;

  @Column({ name: 'idempotency_key', type: 'uuid', unique: true })
  idempotencyKey!: string;

  @Column({ name: 'trace_id', nullable: true })
  traceId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
