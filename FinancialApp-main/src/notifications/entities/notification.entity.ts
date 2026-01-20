import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum NotificationType {
  TRANSACTION = 'TRANSACTION',
  PAYMENT = 'PAYMENT',
  CARD_CONTROL = 'CARD_CONTROL',
  KYC = 'KYC',
  LIMIT = 'LIMIT',
  SYSTEM = 'SYSTEM',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  status!: NotificationStatus;

  @Column({ type: 'jsonb', nullable: true })
  channels?: string[];

  @Column({ name: 'read_at', nullable: true })
  readAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

