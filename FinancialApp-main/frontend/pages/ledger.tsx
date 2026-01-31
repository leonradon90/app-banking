import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Layout } from '../components/Sidebar';
import { apiRequest } from '../lib/api';

type LedgerEntry = {
  id: number;
  debitAccountId: number;
  creditAccountId: number;
  amount: string;
  currency: string;
  idempotencyKey: string;
  traceId?: string;
  createdAt: string;
};

type BalanceVerification = {
  accountBalance: number;
  calculatedBalance: number;
  isConsistent: boolean;
};

export default function Ledger() {
  const router = useRouter();
  const [accountId, setAccountId] = useState('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [verification, setVerification] = useState<BalanceVerification | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isReconciling, setReconciling] = useState(false);
  const [isLoading, setLoading] = useState(false);

  const fetchLedger = useCallback(async (targetAccountId: string) => {
    setMessage(null);
    setVerification(null);
    setLoading(true);
    try {
      const [history, balanceCheck] = await Promise.all([
        apiRequest<LedgerEntry[]>({ path: `/ledger/account/${targetAccountId}` }),
        apiRequest<BalanceVerification>({ path: `/ledger/account/${targetAccountId}/balance/verify` }),
      ]);
      setEntries(history);
      setVerification(balanceCheck);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const { accountId: queryAccountId } = router.query;
    if (typeof queryAccountId === 'string') {
      setAccountId(queryAccountId);
      fetchLedger(queryAccountId);
    }
  }, [fetchLedger, router.isReady, router.query]);

  const handleFetch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accountId) return;
    await fetchLedger(accountId);
  };

  const handleReconcile = async () => {
    if (!verification) return;
    const difference = verification.accountBalance - verification.calculatedBalance;
    if (difference <= 0) {
      setMessage('Unable to adjust automatically. Please contact support.');
      return;
    }
    setReconciling(true);
    setMessage(null);
    try {
      await apiRequest({
        path: `/ledger/account/${accountId}/reconcile`,
        method: 'POST',
      });
      const [history, balanceCheck] = await Promise.all([
        apiRequest<LedgerEntry[]>({ path: `/ledger/account/${accountId}` }),
        apiRequest<BalanceVerification>({ path: `/ledger/account/${accountId}/balance/verify` }),
      ]);
      setEntries(history);
      setVerification(balanceCheck);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setReconciling(false);
    }
  };

  return (
    <Layout title="Transaction history" subtitle="Transactions">
      <div className="space-y-8">
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">View transactions</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            This is the full list of transfers for the account you select.
          </p>
          <form className="mt-6 flex flex-wrap items-end gap-4" onSubmit={handleFetch}>
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Account ID</label>
              <input
                required
                type="number"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="input-field mt-2"
                placeholder="Find this on the Accounts page"
              />
            </div>
            <button
              type="submit"
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load transactions'}
            </button>
          </form>
          {message && <p className="mt-4 text-xs text-brand-secondary">{message}</p>}
        </section>

        {verification && (
          <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
            <h3 className="section-title">Balance check</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Account balance</p>
                <p className="text-lg font-semibold text-brand-secondary">${verification.accountBalance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Calculated balance</p>
                <p className="text-lg font-semibold text-brand-secondary">${verification.calculatedBalance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Status</p>
                <span className={verification.isConsistent ? 'badge-green' : 'badge-red'}>
                  {verification.isConsistent ? 'Matched' : 'Needs review'}
                </span>
              </div>
            </div>
            {!verification.isConsistent && (
              <div className="mt-4 rounded-2xl border border-dashed border-brand-primary/40 bg-brand-primary/5 p-4 text-xs text-brand-secondary">
                If the balance was created before transactions started, this can look off. You can add a one-time opening balance.
                <button
                  type="button"
                  onClick={handleReconcile}
                  disabled={isReconciling}
                  className="btn-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isReconciling ? 'Reconciling...' : 'Post opening balance'}
                </button>
              </div>
            )}
          </section>
        )}

        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Entries</h3>
          {entries.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-4 text-xs text-[var(--muted)]">
              No entries yet. Make a transfer to generate records.
            </p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              {entries.map((entry) => (
                <article key={entry.id} className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-brand-secondary">Transfer #{entry.id}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {entry.debitAccountId} to {entry.creditAccountId} - {entry.currency}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-brand-secondary">${Number(entry.amount).toFixed(2)}</p>
                  </div>
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    <p>Reference: {entry.idempotencyKey}</p>
                    <p>Trace ID: {entry.traceId ?? '-'}</p>
                    <p>Created: {new Date(entry.createdAt ?? new Date().toISOString()).toLocaleString()}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
