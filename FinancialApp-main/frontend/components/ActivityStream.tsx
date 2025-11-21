import { formatDistanceToNow } from 'date-fns';

export type ActivityEvent = {
  id: string;
  title: string;
  description: string;
  status: 'success' | 'pending' | 'blocked';
  occurredAt: string;
  actor?: string;
};

type ActivityStreamProps = {
  events: ActivityEvent[];
  title?: string;
};

const statusStyles: Record<ActivityEvent['status'], string> = {
  success: 'badge-green',
  pending: 'badge-amber',
  blocked: 'badge-red',
};

export function ActivityStream({ events, title }: ActivityStreamProps) {
  return (
    <div className="glass-panel shadow-panel rounded-3xl border border-[var(--border)] bg-white/90 p-6">
      {title && <h3 className="text-sm font-semibold text-brand-secondary/80">{title}</h3>}
      <ol className="mt-4 space-y-4">
        {events.map((event) => (
          <li key={event.id} className="rounded-2xl border border-transparent bg-white/60 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand-secondary">{event.title}</p>
                <p className="text-xs text-[var(--muted)]">{event.description}</p>
                {event.actor && <p className="mt-1 text-xs text-brand-secondary/70">Actor: {event.actor}</p>}
              </div>
              <span className={statusStyles[event.status]}>{event.status}</span>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              {formatDistanceToNow(new Date(event.occurredAt), { addSuffix: true })}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
