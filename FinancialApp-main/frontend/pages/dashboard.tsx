import { ActivityStream, ActivityEvent } from '../components/ActivityStream';
import { Layout } from '../components/Sidebar';
import { MetricsPanel } from '../components/MetricsPanel';
import { useApiResource } from '../hooks/useApiResource';

interface AccountsSummary {
  totalBalance: string;
  currencies: Array<{ currency: string; total: string }>;
  customers: number;
}

interface PaymentVelocity {
  todayCount: number;
  todayAmount: string;
  failRate: number;
  softDeclines: number;
}

interface AuditEvent {
  id: number;
  actor: string;
  action: string;
  created_at: string;
}

interface DashboardResponse {
  accounts: AccountsSummary;
  payments: PaymentVelocity;
  audit: AuditEvent[];
}

const fallbackData: DashboardResponse = {
  accounts: {
    totalBalance: '4,250,192.54',
    currencies: [
      { currency: 'USD', total: '2,620,192.10' },
      { currency: 'EUR', total: '1,230,000.00' },
      { currency: 'GBP', total: '400,000.44' },
    ],
    customers: 1280,
  },
  payments: {
    todayCount: 864,
    todayAmount: '742,500.00',
    failRate: 0.6,
    softDeclines: 12,
  },
  audit: [
    {
      id: 1,
      actor: 'user_42',
      action: 'PAYMENT_APPROVED',
      created_at: new Date().toISOString(),
    },
  ],
};

export default function Dashboard() {
  const { data } = useApiResource<DashboardResponse>({ path: '/api/v1/dashboard', fallbackData });

  const metrics = [
    {
      label: 'Total balance managed',
      value: `$${data?.accounts.totalBalance ?? fallbackData.accounts.totalBalance}`,
      caption: `${data?.accounts.customers ?? fallbackData.accounts.customers} active customers`,
    },
    {
      label: 'Payments processed today',
      value: `${data?.payments.todayCount ?? fallbackData.payments.todayCount}`,
      caption: `$${data?.payments.todayAmount ?? fallbackData.payments.todayAmount}`,
      delta: `${((1 - (data?.payments.failRate ?? fallbackData.payments.failRate) / 100) * 100).toFixed(1)}% success rate`,
    },
    {
      label: 'Soft declines (24h)',
      value: `${data?.payments.softDeclines ?? fallbackData.payments.softDeclines}`,
      caption: 'Driven by limits & behavioral analytics',
    },
  ];

  const auditEvents: ActivityEvent[] = (data?.audit ?? fallbackData.audit).map((event) => ({
    id: String(event.id),
    title: event.action.replaceAll('_', ' '),
    description: 'Event recorded in immutable audit log',
    status: 'success',
    occurredAt: event.created_at,
    actor: event.actor,
  }));

  return (
    <Layout
      title="Realtime operations overview"
      subtitle="Dashboard"
      rightColumn={<ActivityStream events={auditEvents} title="Latest audit trail" />}
    >
      <div className="space-y-8">
        <MetricsPanel metrics={metrics} title="Ledger health" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-[var(--border)] bg-white/80 p-6">
            <h3 className="text-sm font-semibold text-brand-secondary">Currency allocation</h3>
            <ul className="mt-4 space-y-4 text-sm">
              {(data?.accounts.currencies ?? fallbackData.accounts.currencies).map((currency) => (
                <li key={currency.currency} className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 shadow-sm">
                  <span>{currency.currency}</span>
                  <span className="font-medium">${currency.total}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/80 p-6">
            <h3 className="text-sm font-semibold text-brand-secondary">Event-driven SLAs</h3>
            <ul className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              <li>
                <span className="font-semibold text-brand-secondary">Push latency</span>
                <p>&lt; 1.5 s end-to-end via Kafka → Notifications service → Firebase</p>
              </li>
              <li>
                <span className="font-semibold text-brand-secondary">Card freeze reaction</span>
                <p>&lt; 300 ms with Redis-backed auth pre-check</p>
              </li>
              <li>
                <span className="font-semibold text-brand-secondary">Ledger posting</span>
                <p>Strict double entry with idempotency key enforcement</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
