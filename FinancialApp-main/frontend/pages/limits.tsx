import { FormEvent, useState } from 'react';
import { Layout } from '../components/Sidebar';
import { apiRequest } from '../lib/api';
import { useApiResource } from '../hooks/useApiResource';

interface LimitRule {
  id: number;
  scope: 'DAILY' | 'MONTHLY' | 'PER_TRANSACTION';
  threshold: string;
  accountId?: number;
  userId?: number;
  active: boolean;
  createdAt: string;
}

const fallbackRules: LimitRule[] = [];

export default function Limits() {
  const { data, refresh } = useApiResource<LimitRule[]>({ path: '/limits', fallbackData: fallbackRules });
  const [scope, setScope] = useState<LimitRule['scope']>('DAILY');
  const [threshold, setThreshold] = useState('');
  const [accountId, setAccountId] = useState('');
  const [userId, setUserId] = useState('');
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    try {
      await apiRequest({
        path: '/limits',
        method: 'POST',
        body: {
          scope,
          threshold: Number(threshold),
          ...(accountId ? { accountId: Number(accountId) } : {}),
          ...(userId ? { userId: Number(userId) } : {}),
          active,
        },
      });
      setThreshold('');
      setAccountId('');
      setUserId('');
      refresh();
      setMessage('Limit saved. You will be notified if it is reached.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <Layout title="Spending limits" subtitle="Limits">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <h3 className="section-title">Your limits</h3>
          <div className="grid gap-4">
            {(data ?? fallbackRules).length === 0 ? (
              <article className="rounded-3xl border border-dashed border-[var(--border)] bg-white/70 p-6 text-sm text-[var(--muted)]">
                No limits set yet.
              </article>
            ) : (
              (data ?? fallbackRules).map((rule) => (
                <article key={rule.id} className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-brand-secondary">{rule.scope.replace('_', ' ')}</p>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        {rule.accountId ? `Account ${rule.accountId}` : rule.userId ? `User ${rule.userId}` : 'Global'}
                      </p>
                    </div>
                    <span className="badge badge-amber">Limit {Number(rule.threshold).toLocaleString()}</span>
                  </div>
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Status: {rule.active ? 'Active' : 'Disabled'} - Created {new Date(rule.createdAt).toLocaleString()}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Set a limit</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Set a daily, monthly, or per-transfer limit to stay in control.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleCreate}>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Scope</label>
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as LimitRule['scope'])}
                className="input-field mt-2"
              >
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
                <option value="PER_TRANSACTION">Per transaction</option>
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Threshold</label>
                <input
                  required
                  type="number"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                  className="input-field mt-2"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Account ID (optional)</label>
                <input
                  type="number"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  className="input-field mt-2"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">User ID (optional)</label>
              <input
                type="number"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="input-field mt-2"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              Active immediately
            </label>
            <button
              type="submit"
              className="btn-primary w-full"
            >
              Create rule
            </button>
          </form>
          {message && <p className="mt-4 text-xs text-brand-secondary">{message}</p>}
        </section>
      </div>
    </Layout>
  );
}
