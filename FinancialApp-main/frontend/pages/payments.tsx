import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Layout } from '../components/Sidebar';
import { ActivityStream, ActivityEvent } from '../components/ActivityStream';
import { apiRequest } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useApiResource } from '../hooks/useApiResource';

type Account = {
  id: number;
  currency: string;
  balance: string;
  status: string;
};

type PaymentResponse = {
  status: 'success' | 'pending' | 'scheduled';
  message: string;
  transactionId?: number;
  transaction_id?: number;
  scheduleId?: number;
  scheduledFor?: string;
  gatewayReference?: string;
};

type PaymentSchedule = {
  id: number;
  status: string;
  scheduledFor: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  ledgerEntryId?: number;
  processedAt?: string;
};

export default function Payments() {
  const { session } = useAuth();
  const router = useRouter();
  const { data: accounts } = useApiResource<Account[]>({ path: '/accounts', fallbackData: [] });
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [description, setDescription] = useState('');
  const [transferType, setTransferType] = useState<'INTERNAL' | 'INTERBANK'>('INTERNAL');
  const [beneficiaryIban, setBeneficiaryIban] = useState('');
  const [beneficiaryBank, setBeneficiaryBank] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [cardToken, setCardToken] = useState('');
  const [mcc, setMcc] = useState('');
  const [geoLocation, setGeoLocation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [isLoadingSchedules, setLoadingSchedules] = useState(false);

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const isKycBlocked = session?.user.kycStatus === 'PENDING' || session?.user.kycStatus === 'REJECTED';
  const availableAccounts = (accounts ?? []).filter((account) => account.status === 'ACTIVE');
  const selectedAccount = availableAccounts.find((account) => String(account.id) === fromAccount);
  const scheduleStatusStyles: Record<string, string> = {
    SCHEDULED: 'badge-amber',
    PROCESSING: 'badge-amber',
    COMPLETED: 'badge-green',
    FAILED: 'badge-red',
    CANCELLED: 'badge-red',
  };
  const parsedAmount = Number(amount);
  const availableBalance = selectedAccount ? Number(selectedAccount.balance) : null;
  const exceedsBalance =
    availableBalance !== null && !Number.isNaN(parsedAmount) && parsedAmount > availableBalance;
  const receiptPreview = useMemo(() => {
    const amountValue = amount ? Number(amount).toFixed(2) : '--';
    const scheduleLabel = scheduledFor ? new Date(scheduledFor).toLocaleString() : 'Instant';
    return `From account: ${fromAccount || '--'}
To account: ${transferType === 'INTERNAL' ? toAccount || '--' : 'External beneficiary'}
Amount: ${amountValue} ${currency}
Type: ${transferType}
Status: success or pending
Scheduled for: ${scheduleLabel}`;
  }, [amount, currency, fromAccount, scheduledFor, toAccount, transferType]);
  const canSubmit = useMemo(() => {
    if (!fromAccount || !amount) return false;
    if (transferType === 'INTERNAL' && !toAccount) return false;
    if (transferType === 'INTERBANK' && (!beneficiaryIban || !beneficiaryBank)) return false;
    return true;
  }, [amount, beneficiaryBank, beneficiaryIban, fromAccount, toAccount, transferType]);

  useEffect(() => {
    if (selectedAccount) {
      setCurrency(selectedAccount.currency);
    } else {
      setCurrency('USD');
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (!router.isReady) return;
    const { from, to, type } = router.query;
    if (typeof from === 'string') setFromAccount(from);
    if (typeof to === 'string') setToAccount(to);
    if (typeof type === 'string' && type.toLowerCase() === 'interbank') {
      setTransferType('INTERBANK');
    }
  }, [router.isReady, router.query]);

  const loadSchedules = async () => {
    setLoadingSchedules(true);
    setMessage(null);
    try {
      const response = await apiRequest<PaymentSchedule[]>({
        path: '/payments/schedules',
      });
      setSchedules(response);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const cancelSchedule = async (id: number) => {
    setMessage(null);
    try {
      await apiRequest({
        path: `/payments/schedules/${id}/cancel`,
        method: 'POST',
      });
      await loadSchedules();
      setMessage('Scheduled transfer cancelled.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (session && isKycBlocked) {
      setMessage('Verification required to send transfers. Complete verification to continue.');
      return;
    }
    if (!fromAccount) {
      setMessage('Select a sender account to continue.');
      return;
    }
    if (transferType === 'INTERNAL' && !toAccount) {
      setMessage('Enter a recipient account for internal transfers.');
      return;
    }
    if (transferType === 'INTERBANK' && (!beneficiaryIban || !beneficiaryBank)) {
      setMessage('Please provide the beneficiary IBAN and bank name for interbank transfers.');
      return;
    }
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const payload: Record<string, unknown> = {
        fromAccount: Number(fromAccount),
        amount: Number(amount),
        currency,
        idempotencyKey,
        transferType,
        ...(beneficiaryIban ? { beneficiaryIban } : {}),
        ...(beneficiaryBank ? { beneficiaryBank } : {}),
        ...(scheduledFor ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
        ...(description ? { description } : {}),
        ...(cardToken ? { cardToken } : {}),
        ...(mcc ? { mcc: Number(mcc) } : {}),
        ...(geoLocation ? { geoLocation } : {}),
      };
      if (transferType === 'INTERNAL') {
        payload.toAccount = Number(toAccount);
      } else if (toAccount) {
        payload.toAccount = Number(toAccount);
      }
      const response = await apiRequest<PaymentResponse>({
        path: '/payments',
        method: 'POST',
        body: payload,
        idempotencyKey,
      });
      setMessage(response.message);

      if (response.status === 'scheduled') {
        const scheduledEvent: ActivityEvent = {
          id: String(response.scheduleId ?? Date.now()),
          title: `Transfer scheduled ${currency} ${Number(amount).toFixed(2)}`,
          description: `From ${fromAccount} to ${toAccount}`,
          status: 'pending',
          occurredAt: new Date().toISOString(),
        };
        setEvents((prev) =>
          [scheduledEvent, ...prev].slice(0, 8)
        );
        await loadSchedules();
      } else {
        const txId = response.transactionId ?? response.transaction_id ?? Date.now();
        const transferEvent: ActivityEvent = {
          id: String(txId),
          title: `${response.status === 'pending' ? 'Interbank transfer' : 'Transfer'} ${currency} ${Number(amount).toFixed(2)}`,
          description: `From ${fromAccount} to ${toAccount}`,
          status: response.status === 'pending' ? 'pending' : 'success',
          occurredAt: new Date().toISOString(),
        };
        setEvents((prev) =>
          [transferEvent, ...prev].slice(0, 8)
        );
      }
      setAmount('');
      setToAccount('');
      setFromAccount('');
      setDescription('');
      setCardToken('');
      setMcc('');
      setGeoLocation('');
      setBeneficiaryIban('');
      setBeneficiaryBank('');
      setScheduledFor('');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout
      title="Send money"
      subtitle="Transfers"
      rightColumn={<ActivityStream events={events} title="Recent transfers" />}
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section>
          {isKycBlocked && (
            <div className="mb-4 rounded-3xl border border-dashed border-brand-primary/40 bg-brand-primary/5 p-4 text-xs text-brand-secondary">
              Verification required: you can explore the form, but transfers will run only after your ID is verified.
            </div>
          )}
          {availableAccounts.length === 0 && (
            <div className="mb-4 rounded-3xl border border-dashed border-brand-primary/30 bg-white/80 p-4 text-xs text-[var(--muted)]">
              Create an account first, then return here to send your first transfer.
            </div>
          )}
          {exceedsBalance && (
            <div className="mb-4 rounded-3xl border border-dashed border-amber-400/60 bg-amber-50 p-4 text-xs text-amber-800">
              This transfer exceeds the available balance on the selected account and may be rejected.
            </div>
          )}
          <h3 className="section-title">Start a transfer</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Transfers are processed in real time. You will see the status right away.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">From account</label>
                <select
                  required
                  value={fromAccount}
                  onChange={(event) => setFromAccount(event.target.value)}
                  className="input-field mt-2"
                >
                  <option value="">Select an account</option>
                  {availableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      #{account.id} - {account.currency} {Number(account.balance).toFixed(2)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-[var(--muted)]">Only active accounts can send transfers.</p>
              </div>
              {transferType === 'INTERNAL' ? (
                <div>
                  <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Recipient account</label>
                  <input
                    required
                    type="number"
                    value={toAccount}
                    onChange={(event) => setToAccount(event.target.value)}
                    className="input-field mt-2"
                  />
                  <p className="mt-2 text-xs text-[var(--muted)]">Enter another account ID to send a transfer.</p>
                </div>
              ) : (
                <div>
                  <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Recipient account (optional)</label>
                  <input
                    type="number"
                    value={toAccount}
                    onChange={(event) => setToAccount(event.target.value)}
                    className="input-field mt-2"
                    placeholder="Internal reference (optional)"
                  />
                  <p className="mt-2 text-xs text-[var(--muted)]">For interbank transfers this is optional.</p>
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Amount</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="input-field mt-2"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Currency</label>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  disabled={Boolean(selectedAccount)}
                  className="input-field mt-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                {selectedAccount && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Currency is set by the selected account. Available {selectedAccount.currency}{' '}
                    {Number(selectedAccount.balance).toFixed(2)}.
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Description</label>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="input-field mt-2"
                placeholder="Client payout or invoice reference"
              />
            </div>
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-4">
              <p className="text-xs font-semibold text-brand-secondary">Transfer options</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Transfer type</label>
                  <select
                    value={transferType}
                    onChange={(event) => setTransferType(event.target.value as 'INTERNAL' | 'INTERBANK')}
                    className="input-field mt-2"
                  >
                    <option value="INTERNAL">Internal</option>
                    <option value="INTERBANK">Interbank</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Schedule date/time</label>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                    className="input-field mt-2"
                  />
                </div>
              </div>
              {transferType === 'INTERBANK' && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Beneficiary IBAN</label>
                    <input
                      value={beneficiaryIban}
                      onChange={(event) => setBeneficiaryIban(event.target.value)}
                      className="input-field mt-2"
                      placeholder="DE89 3704 0044 0532 0130 00"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Beneficiary bank</label>
                    <input
                      value={beneficiaryBank}
                      onChange={(event) => setBeneficiaryBank(event.target.value)}
                      className="input-field mt-2"
                      placeholder="Stub Bank"
                    />
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-[var(--muted)]">
                Estimated arrival:{' '}
                {transferType === 'INTERBANK' ? '1-2 business days (status pending)' : 'Instant'}
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-4">
              <p className="text-xs font-semibold text-brand-secondary">Card details (optional)</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Card token (optional)</label>
                  <input
                    value={cardToken}
                    onChange={(event) => setCardToken(event.target.value)}
                    className="input-field mt-2"
                    placeholder="card_abc123"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-[var(--muted)]">MCC</label>
                  <input
                    type="number"
                    value={mcc}
                    onChange={(event) => setMcc(event.target.value)}
                    className="input-field mt-2"
                    placeholder="5411"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Geo location</label>
                <input
                  value={geoLocation}
                  onChange={(event) => setGeoLocation(event.target.value.toUpperCase())}
                  className="input-field mt-2"
                  placeholder="US"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Processing...' : 'Send transfer'}
            </button>
          </form>
          {message && <p className="mt-4 text-xs text-brand-secondary">{message}</p>}
        </section>
        <section className="space-y-4">
          <h3 className="section-title">Transfer tips</h3>
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 text-sm text-[var(--muted)]">
            <ul className="space-y-3">
              <li>• Make sure the sender account has enough balance.</li>
              <li>• Scheduled transfers will run at the selected time.</li>
              <li>• You will receive a notification when the transfer completes.</li>
              <li>• Duplicate submissions are safely ignored.</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 text-sm text-[var(--muted)]">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-brand-secondary">Scheduled transfers</h4>
              <button
                type="button"
                onClick={loadSchedules}
                className="btn-outline px-3 py-1"
              >
                {isLoadingSchedules ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            {schedules.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--muted)]">No scheduled transfers yet.</p>
            ) : (
              <div className="mt-3 space-y-3 text-xs">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-2xl border border-[var(--border)] bg-white/70 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-brand-secondary">Schedule #{schedule.id}</p>
                      <span className={scheduleStatusStyles[schedule.status] ?? 'badge-amber'}>{schedule.status}</span>
                    </div>
                    <p className="mt-1">Scheduled for: {new Date(schedule.scheduledFor).toLocaleString()}</p>
                    {schedule.ledgerEntryId && <p className="mt-1">Transaction ID: {schedule.ledgerEntryId}</p>}
                    {schedule.lastError && <p className="mt-1 text-brand-secondary">{schedule.lastError}</p>}
                    {schedule.status === 'SCHEDULED' && (
                      <button
                        type="button"
                        onClick={() => cancelSchedule(schedule.id)}
                        className="btn-outline mt-2 px-3 py-1"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 text-sm text-[var(--muted)]">
            <h4 className="text-sm font-semibold text-brand-secondary">Receipt preview</h4>
            <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-900/90 p-4 text-xs text-slate-100">
{receiptPreview}
            </pre>
          </div>
        </section>
      </div>
    </Layout>
  );
}
