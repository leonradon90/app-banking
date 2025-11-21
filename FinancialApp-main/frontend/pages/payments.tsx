import { FormEvent, useState } from 'react';
import { Layout } from '../components/Sidebar';
import { ActivityStream, ActivityEvent } from '../components/ActivityStream';
import { apiRequest } from '../lib/api';

interface Payment {
  id: number;
  debit_account: number;
  credit_account: number;
  amount: string;
  currency: string;
  created_at: string;
}

const fallbackPayments: Payment[] = [
  {
    id: 901,
    debit_account: 101,
    credit_account: 102,
    amount: '250.00',
    currency: 'USD',
    created_at: new Date().toISOString(),
  },
  {
    id: 902,
    debit_account: 203,
    credit_account: 102,
    amount: '50.00',
    currency: 'GBP',
    created_at: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
  },
];

export default function Payments() {
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const events: ActivityEvent[] = fallbackPayments.map((payment) => ({
    id: String(payment.id),
    title: `Payment ${payment.currency} ${payment.amount}`,
    description: `Debit ${payment.debit_account} → Credit ${payment.credit_account}`,
    status: 'success',
    occurredAt: payment.created_at,
  }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      await apiRequest({
        path: '/api/v1/payments',
        method: 'POST',
        body: {
          from_account: Number(fromAccount),
          to_account: Number(toAccount),
          amount: Number(amount),
          currency,
          idempotency_key: idempotencyKey,
        },
        idempotencyKey,
      });
      setMessage('Payment submitted. Ledger + audit entries were created and TRANSACTION_SUCCESS emitted.');
      setAmount('');
      setToAccount('');
      setFromAccount('');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout
      title="Payments orchestration"
      subtitle="Payments"
      rightColumn={<ActivityStream events={events} title="Recent payments" />}
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section>
          <h3 className="section-title">Initiate transfer</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            The form mirrors the REST contract. Optimistic UI is encouraged – backend enforces double entry and idempotency.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">From account</label>
                <input
                  required
                  type="number"
                  value={fromAccount}
                  onChange={(event) => setFromAccount(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">To account</label>
                <input
                  required
                  type="number"
                  value={toAccount}
                  onChange={(event) => setToAccount(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Amount</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
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
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:bg-brand-primary/60"
            >
              {isSubmitting ? 'Processing…' : 'Submit payment'}
            </button>
          </form>
          {message && <p className="mt-4 text-xs text-brand-secondary">{message}</p>}
        </section>
        <section className="space-y-4">
          <h3 className="section-title">Operational guidelines</h3>
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 text-sm text-[var(--muted)]">
            <ul className="space-y-3">
              <li>• Pre-flight checks: account status, KYC level, daily limits, and balance sufficiency.</li>
              <li>• Retries are idempotent. Clients re-use the same Idempotency-Key header.</li>
              <li>• Webhooks (signed with HMAC) notify downstream systems about status transitions.</li>
              <li>• TRANSACTION_SUCCESS → Notifications → Push & Email within 2 seconds.</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 text-sm text-[var(--muted)]">
            <h4 className="text-sm font-semibold text-brand-secondary">API reference</h4>
            <p className="mt-2 font-mono text-xs text-brand-secondary/80">POST /api/v1/payments</p>
            <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-900/90 p-4 text-xs text-slate-100">
{`{
  "from_account": 1,
  "to_account": 2,
  "amount": 250,
  "currency": "USD",
  "idempotency_key": "uuid"
}`}
            </pre>
          </div>
        </section>
      </div>
    </Layout>
  );
}
