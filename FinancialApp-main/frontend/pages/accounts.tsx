import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { Layout } from '../components/Sidebar';
import { useApiResource } from '../hooks/useApiResource';
import { apiRequest } from '../lib/api';

interface Account {
  id: number;
  userId: number;
  user_id?: number;
  currency: string;
  balance: string;
  status: string;
  createdAt?: string;
}

const fallbackAccounts: Account[] = [
  { id: 101, userId: 12, currency: 'USD', balance: '12500.30', status: 'ACTIVE' },
  { id: 102, userId: 12, currency: 'EUR', balance: '5200.12', status: 'ACTIVE' },
  { id: 203, userId: 54, currency: 'GBP', balance: '980.00', status: 'FROZEN' },
];

export default function Accounts() {
  const { data, refresh } = useApiResource<Account[]>({ path: '/accounts', fallbackData: fallbackAccounts });
  const [currency, setCurrency] = useState('USD');
  const [initialBalance, setInitialBalance] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [fundAccountId, setFundAccountId] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [fundMessage, setFundMessage] = useState<string | null>(null);
  const [isFunding, setFunding] = useState(false);

  const accounts = useMemo(() => data ?? fallbackAccounts, [data]);
  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const statusStyles: Record<string, string> = {
    ACTIVE: 'badge-green',
    FROZEN: 'badge-amber',
    CLOSED: 'badge-red',
  };

  const copyAccountId = async (accountId: number) => {
    setNotice(null);
    try {
      await navigator.clipboard.writeText(String(accountId));
      setNotice(`Account ${accountId} copied to clipboard.`);
    } catch {
      setNotice('Unable to copy. Your browser may block clipboard access.');
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await apiRequest<Account>({
        path: '/accounts',
        method: 'POST',
        body: {
          currency,
          ...(initialBalance ? { initialBalance: Number(initialBalance) } : {}),
        },
      });
      setMessage(`Account ${response.id} created.`);
      setInitialBalance('');
      refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFundMessage(null);
    setFunding(true);
    try {
      await apiRequest({
        path: `/accounts/${fundAccountId}/fund`,
        method: 'POST',
        body: { amount: Number(fundAmount) },
      });
      setFundMessage('Funds added.');
      setFundAccountId('');
      setFundAmount('');
      refresh();
    } catch (error) {
      setFundMessage((error as Error).message);
    } finally {
      setFunding(false);
    }
  };

  return (
    <Layout
      title="Accounts and balances"
      subtitle="Accounts"
      rightColumn={
        <div className="flex flex-col gap-6">
          <div className="glass-panel rounded-3xl border border-[var(--border)] bg-white/80 p-6 text-sm text-[var(--muted)]">
            <h3 className="text-sm font-semibold text-brand-secondary">How accounts work</h3>
            <ul className="mt-4 space-y-3">
              <li>• Transfers update balances automatically.</li>
              <li>• Every movement is recorded in your transaction history.</li>
              <li>• Account status can be Active, Frozen, or Closed.</li>
            </ul>
          </div>
          <div className="glass-panel rounded-3xl border border-[var(--border)] bg-white/80 p-6">
            <h3 className="text-sm font-semibold text-brand-secondary">Add funds</h3>
            <p className="mt-2 text-xs text-[var(--muted)]">Use this to top up an account for testing.</p>
            <form className="mt-4 space-y-3" onSubmit={handleFund}>
              <input
                type="number"
                value={fundAccountId}
                onChange={(event) => setFundAccountId(event.target.value)}
                placeholder="Account ID"
                className="input-field"
                required
              />
              <input
                type="number"
                step="0.01"
                value={fundAmount}
                onChange={(event) => setFundAmount(event.target.value)}
                placeholder="Amount"
                className="input-field"
                required
              />
              <button
                type="submit"
                disabled={isFunding}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isFunding ? 'Adding...' : 'Add funds'}
              </button>
            </form>
            {fundMessage && <p className="mt-3 text-xs text-brand-secondary">{fundMessage}</p>}
          </div>
        </div>
      }
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="section-title">Accounts</h3>
              <p className="mt-2 text-xs text-[var(--muted)]">Total balance ${totalBalance.toFixed(2)}</p>
            </div>
            <button type="button" onClick={refresh} className="btn-outline">
              Refresh
            </button>
          </div>
          {notice && <p className="text-xs text-brand-secondary">{notice}</p>}
          <div className="grid gap-4">
            {accounts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white/70 p-6 text-sm text-[var(--muted)]">
                No accounts yet. Open your first account to get started.
              </div>
            ) : (
              accounts.map((account) => (
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
                      <p>Currency: {account.currency}</p>
                      <span className={statusStyles[account.status] ?? 'badge-amber'}>{account.status}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                    <button type="button" onClick={() => copyAccountId(account.id)} className="btn-outline">
                      Copy ID
                    </button>
                    <Link href={`/payments?from=${account.id}`} className="btn-soft">
                      Send transfer
                    </Link>
                    <Link href={`/ledger?accountId=${account.id}`} className="btn-outline">
                      View ledger
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Open an account</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Open a new account in USD, EUR, or GBP.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleCreate}>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Starting balance (optional)</label>
              <input
                type="number"
                step="0.01"
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
                className="input-field mt-2"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Currency</label>
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="input-field mt-2"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Opening...' : 'Open account'}
            </button>
          </form>
          {message && <p className="mt-4 text-xs text-brand-secondary">{message}</p>}
        </section>
      </div>
    </Layout>
  );
}
