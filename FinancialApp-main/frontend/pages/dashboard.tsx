import Link from 'next/link';
import { ActivityStream, ActivityEvent } from '../components/ActivityStream';
import { Layout } from '../components/Sidebar';
import { MetricsPanel } from '../components/MetricsPanel';
import { useApiResource } from '../hooks/useApiResource';
import { useAuth } from '../hooks/useAuth';

interface Account {
  id: number;
  currency: string;
  balance: string;
  status: string;
}

interface AuditEvent {
  id: number;
  actor: string;
  action: string;
  createdAt?: string;
  created_at?: string;
}

interface PaginatedAuditLogs {
  data: AuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AuditStat {
  action: string;
  count: number;
}

const fallbackAccounts: Account[] = [];
const fallbackAudit: PaginatedAuditLogs = { data: [], total: 0, page: 1, limit: 6, totalPages: 1 };
const fallbackStats: AuditStat[] = [];
const formatAction = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function Dashboard() {
  const { session } = useAuth();
  const { data: accounts } = useApiResource<Account[]>({ path: '/accounts', fallbackData: fallbackAccounts });
  const { data: auditLogs } = useApiResource<PaginatedAuditLogs>({
    path: '/audit?limit=6',
    fallbackData: fallbackAudit,
    refreshInterval: 10000,
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const statsPath = `/audit/stats?startDate=${encodeURIComponent(startOfDay.toISOString())}`;
  const { data: stats } = useApiResource<AuditStat[]>({
    path: statsPath,
    fallbackData: fallbackStats,
    refreshInterval: 15000,
  });

  const totalBalance = (accounts ?? []).reduce((sum, account) => sum + Number(account.balance), 0);
  const currencyTotals = (accounts ?? []).reduce<Record<string, number>>((acc, account) => {
    acc[account.currency] = (acc[account.currency] ?? 0) + Number(account.balance);
    return acc;
  }, {});

  const statsMap = new Map((stats ?? []).map((entry) => [entry.action, entry.count]));
  const paymentsCompleted = statsMap.get('PAYMENT_COMPLETED') ?? 0;
  const limitRejected = statsMap.get('LIMIT_REJECTED') ?? 0;
  const fraudFailed = statsMap.get('FRAUD_CHECK_FAILED') ?? 0;
  const totalAttempts = paymentsCompleted + limitRejected + fraudFailed;
  const successRate = totalAttempts === 0 ? 100 : (paymentsCompleted / totalAttempts) * 100;

  const metrics = [
    {
      label: 'Total balance',
      value: `$${totalBalance.toFixed(2)}`,
      caption: `${accounts?.length ?? 0} accounts`,
    },
    {
      label: 'Transfers today',
      value: `${paymentsCompleted}`,
      caption: `Total attempts ${totalAttempts}`,
      delta: `Success rate ${successRate.toFixed(1)}%`,
    },
    {
      label: 'Security checks',
      value: `${limitRejected + fraudFailed}`,
      caption: `Limits ${limitRejected} - Alerts ${fraudFailed}`,
    },
  ];

  const auditEvents: ActivityEvent[] = (auditLogs?.data ?? fallbackAudit.data).map((event) => ({
    id: String(event.id),
    title: formatAction(event.action),
    description: 'Recorded activity for your account',
    status: 'success',
    occurredAt: event.createdAt ?? event.created_at ?? new Date().toISOString(),
    actor: event.actor,
  }));

  return (
    <Layout
      title="Your overview"
      subtitle="Home"
      requireAuth={false}
      rightColumn={<ActivityStream events={auditEvents} title="Recent activity" />}
    >
      <div className="space-y-8">
        {!session && (
          <div className="rounded-3xl border border-dashed border-brand-primary/40 bg-brand-primary/5 p-4 text-xs text-brand-secondary">
            Preview mode: sign in to load balances, transfers, and activity.
          </div>
        )}
        <MetricsPanel metrics={metrics} title="Overview" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-[var(--border)] bg-white/80 p-6">
            <h3 className="text-sm font-semibold text-brand-secondary">Balance by currency</h3>
            <ul className="mt-4 space-y-4 text-sm">
              {Object.entries(currencyTotals).length === 0 ? (
                <li className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 px-4 py-3 text-xs text-[var(--muted)]">
                  No balances yet. Create an account to get started.
                </li>
              ) : (
                Object.entries(currencyTotals).map(([currency, total]) => (
                  <li key={currency} className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
                    <span>{currency}</span>
                    <span className="font-medium">${total.toFixed(2)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/80 p-6">
            <h3 className="text-sm font-semibold text-brand-secondary">Helpful reminders</h3>
            <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              <li>
                <span className="font-semibold text-brand-secondary">Stay in control</span>
                <p>Set limits before large transfers to avoid surprises.</p>
              </li>
              <li>
                <span className="font-semibold text-brand-secondary">Card safety</span>
                <p>Freeze your card instantly if it is misplaced.</p>
              </li>
              <li>
                <span className="font-semibold text-brand-secondary">Instant alerts</span>
                <p>Keep notifications enabled to track every transfer.</p>
              </li>
            </ul>
          </div>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="section-title">Quick actions</h3>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Move from onboarding to first transfer in minutes.
              </p>
            </div>
            {session && (
              <span className="badge bg-brand-primary/10 text-brand-primary">
                KYC {session.user.kycStatus}
              </span>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/accounts" className="btn-primary">
              Open an account
            </Link>
            <Link href="/payments" className="btn-outline">
              Send a transfer
            </Link>
            <Link href="/kyc" className="btn-soft">
              Continue verification
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
