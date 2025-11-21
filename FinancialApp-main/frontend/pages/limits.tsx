import { FormEvent, useState } from 'react';
import { Layout } from '../components/Sidebar';
import { apiRequest } from '../lib/api';

interface LimitRule {
  id: number;
  name: string;
  threshold: number;
  window: string;
  action: 'soft_decline' | 'block' | 'review';
}

const fallbackRules: LimitRule[] = [
  { id: 1, name: 'Daily outgoing per user', threshold: 5000, window: '24h', action: 'soft_decline' },
  { id: 2, name: 'Velocity – 5 tx in 10m', threshold: 5, window: '10m', action: 'review' },
  { id: 3, name: 'Country mismatch', threshold: 1, window: 'instant', action: 'block' },
];

export default function Limits() {
  const [rules, setRules] = useState(fallbackRules);
  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState('');
  const [window, setWindow] = useState('24h');
  const [action, setAction] = useState<LimitRule['action']>('soft_decline');
  const [message, setMessage] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    try {
      await apiRequest({
        path: '/api/v1/limits',
        method: 'POST',
        body: {
          name,
          threshold: Number(threshold),
          window,
          action,
        },
      });
      setRules((previous) => [
        ...previous,
        {
          id: Date.now(),
          name,
          threshold: Number(threshold),
          window,
          action,
        },
      ]);
      setName('');
      setThreshold('');
      setMessage('Limit stored. fraud_alerts topic receives alerts when breached.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <Layout title="Limits & anti-fraud" subtitle="Limits">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <h3 className="section-title">Active rules</h3>
          <div className="grid gap-4">
            {rules.map((rule) => (
              <article key={rule.id} className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-brand-secondary">{rule.name}</p>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Window {rule.window}</p>
                  </div>
                  <span className="badge badge-amber">Threshold {rule.threshold.toLocaleString()}</span>
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">Action: {rule.action.replace('_', ' ')}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Add rule</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Tinkoff-inspired scoring with soft decline UX borrowed from Revolut. Rules stream alerts to analytics.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleCreate}>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Name</label>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
                placeholder="Daily outgoing per user"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Threshold</label>
                <input
                  required
                  type="number"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Window</label>
                <input
                  required
                  value={window}
                  onChange={(event) => setWindow(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Action</label>
              <select
                value={action}
                onChange={(event) => setAction(event.target.value as LimitRule['action'])}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
              >
                <option value="soft_decline">Soft decline</option>
                <option value="block">Block</option>
                <option value="review">Manual review</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full rounded-2xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
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
