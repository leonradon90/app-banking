import { FormEvent, useMemo, useState } from 'react';
import { Layout } from '../components/Sidebar';
import { apiRequest } from '../lib/api';

type AuditLog = {
  id: number;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  traceId?: string;
  createdAt?: string;
  created_at?: string;
};

type PaginatedAuditLogs = {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type AuditStat = {
  action: string;
  count: number;
};

const emptyAudit: PaginatedAuditLogs = { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };
const formatAction = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function Audit() {
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [traceId, setTraceId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [logs, setLogs] = useState<PaginatedAuditLogs>(emptyAudit);
  const [stats, setStats] = useState<AuditStat[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (actor) {
      const normalizedActor = /^\d+$/.test(actor.trim()) ? `user_${actor.trim()}` : actor.trim();
      params.set('actor', normalizedActor);
    }
    if (action) params.set('action', action);
    if (traceId) params.set('traceId', traceId);
    if (startDate) params.set('startDate', new Date(startDate).toISOString());
    if (endDate) params.set('endDate', new Date(endDate).toISOString());
    params.set('limit', '20');
    return params.toString();
  };

  const buildStatsQuery = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', new Date(startDate).toISOString());
    if (endDate) params.set('endDate', new Date(endDate).toISOString());
    return params.toString();
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    try {
      const query = buildQuery();
      const statsQuery = buildStatsQuery();
      const [auditLogs, auditStats] = await Promise.all([
        apiRequest<PaginatedAuditLogs>({ path: `/audit?${query}` }),
        apiRequest<AuditStat[]>({ path: `/audit/stats?${statsQuery}` }),
      ]);
      setLogs(auditLogs);
      setStats(auditStats);
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const renderedStats = useMemo(
    () => stats.sort((a, b) => b.count - a.count).slice(0, 6),
    [stats]
  );

  return (
    <Layout title="Activity log" subtitle="Activity">
      <div className="space-y-8">
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Search activity</h3>
          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSearch}>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">User</label>
              <input
                value={actor}
                onChange={(event) => setActor(event.target.value)}
                className="input-field mt-2"
                placeholder="user_1 or 1"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Action</label>
              <input
                value={action}
                onChange={(event) => setAction(event.target.value)}
                className="input-field mt-2"
                placeholder="TRANSFER_COMPLETED"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Reference ID</label>
              <input
                value={traceId}
                onChange={(event) => setTraceId(event.target.value)}
                className="input-field mt-2"
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="input-field mt-2"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="input-field mt-2"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="btn-primary w-full"
              >
                Search activity
              </button>
            </div>
          </form>
          {message && <p className="mt-4 text-xs text-brand-secondary">{message}</p>}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
            <h3 className="section-title">Activity log</h3>
            {logs.data.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-4 text-xs text-[var(--muted)]">
                No activity loaded yet. Run a search to populate this view.
              </p>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                {logs.data.map((log) => (
                  <article key={log.id} className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-brand-secondary">{formatAction(log.action)}</p>
                        <p className="text-xs text-[var(--muted)]">User: {log.actor}</p>
                      </div>
                      <p className="text-xs text-[var(--muted)]">
                        {new Date(log.createdAt ?? log.created_at ?? new Date().toISOString()).toLocaleString()}
                      </p>
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-900/90 p-3 text-xs text-slate-100">
{JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
            <h3 className="section-title">Most common actions</h3>
            {renderedStats.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-4 text-xs text-[var(--muted)]">
                No stats available yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {renderedStats.map((stat) => (
                  <li key={stat.action} className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                    <span>{formatAction(stat.action)}</span>
                    <span className="font-semibold text-brand-secondary">{stat.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
