import { FormEvent, useMemo, useState } from 'react';
import { Layout } from '../components/Sidebar';
import { useApiResource } from '../hooks/useApiResource';
import { apiRequest } from '../lib/api';

interface Account {
  id: number;
  user_id: number;
  currency: string;
  balance: string;
  status: string;
}

const fallbackAccounts: Account[] = [
  { id: 101, user_id: 12, currency: 'USD', balance: '12500.30', status: 'ACTIVE' },
  { id: 102, user_id: 12, currency: 'EUR', balance: '5200.12', status: 'ACTIVE' },
  { id: 203, user_id: 54, currency: 'GBP', balance: '980.00', status: 'SUSPENDED' },
];

export default function Accounts() {
  const { data, refresh } = useApiResource<Account[]>({ path: '/api/v1/accounts', fallbackData: fallbackAccounts });
  const [currency, setCurrency] = useState('USD');
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const accounts = useMemo(() => data ?? fallbackAccounts, [data]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await apiRequest<{ id: number }>({
        path: '/api/v1/accounts',
        method: 'POST',
        body: { currency, user_id: Number(userId) },
      });
      setMessage(`Account ${response.id} created. Ledger baseline event emitted.`);
      setUserId('');
      refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout
      title="Account & balance management"
      subtitle="Accounts"
      rightColumn={
        <div className="glass-panel rounded-3xl border border-[var(--border)] bg-white/80 p-6 text-sm text-[var(--muted)]">
          <h3 className="text-sm font-semibold text-brand-secondary">Design notes</h3>
          <ul className="mt-4 space-y-3">
            <li>• Every balance update passes through the ledger service – no direct mutations.</li>
            <li>• Idempotency is enforced through UUID keys stored on ledger entries.</li>
            <li>• Account states: ACTIVE, SUSPENDED, CLOSED. Suspensions triggered by limits or KYC.</li>
          </ul>
        </div>
      }
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <h3 className="section-title">Portfolio</h3>
          <div className="grid gap-4">
            {accounts.map((account) => (
              <article
                key={account.id}
                className="rounded-3xl border border-[var(--border)] bg-white/90 px-6 py-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Account #{account.id}</p>
                    <p className="mt-1 text-xl font-semibold text-brand-secondary">${Number(account.balance).toFixed(2)}</p>
                  </div>
                  <div className="text-right text-sm text-[var(--muted)]">
                    <p>User: {account.user_id}</p>
                    <p>Currency: {account.currency}</p>
                    <p>Status: {account.status}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Create account</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Mirrors POST /api/v1/accounts – returns the persisted entity and triggers ACCOUNTS_CREATED Kafka event.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleCreate}>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">User ID</label>
              <input
                required
                type="number"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
                placeholder="123"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Currency</label>
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:bg-brand-primary/60"
            >
              {isSubmitting ? 'Provisioning…' : 'Create account'}
            </button>
          </form>
          {message && <p className="mt-4 text-xs text-brand-secondary">{message}</p>}
        </section>
      </div>
    </Layout>
  );
}
