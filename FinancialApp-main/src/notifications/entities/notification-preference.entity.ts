import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity({ name: 'notification_preferences' })
export class NotificationPreference {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  channels!: Record<string, boolean>;

  @Column({ type: 'jsonb', name: 'event_preferences', default: () => "'{}'" })
  eventPreferences!: Record<string, unknown>;
}
