import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', description: 'Balances, velocity, events' },
  { href: '/accounts', label: 'Accounts', description: 'Create and manage client wallets' },
  { href: '/payments', label: 'Payments', description: 'Transfer flows with idempotency' },
  { href: '/card-controls', label: 'Card Controls', description: 'Freeze, limits and MCC rules' },
  { href: '/notifications', label: 'Notifications', description: 'Push center configuration' },
  { href: '/limits', label: 'Limits & Anti-Fraud', description: 'Thresholds, scoring, soft declines' },
  { href: '/kyc', label: 'KYC', description: 'Review verification and documents' },
];

export function Sidebar() {
  const router = useRouter();

  return (
    <aside className="flex h-full w-full max-w-xs flex-col gap-8 border-r border-[var(--border)] bg-white/80 p-6 backdrop-blur-xl">
      <div>
        <p className="text-xs uppercase tracking-wide text-brand-secondary/70">Aurora Bank Core</p>
        <h1 className="mt-2 text-2xl font-semibold text-brand-secondary">Operations Console</h1>
      </div>
      <nav className="flex flex-col gap-4">
        {navItems.map(({ href, label, description }) => {
          const isActive = router.pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-2xl border border-transparent px-4 py-3 transition-all ${
                isActive
                  ? 'bg-brand-primary/10 text-brand-primary shadow-card'
                  : 'hover:border-brand-primary/40 hover:bg-white'
              }`}
            >
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-xs text-[var(--muted)]">{description}</div>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-dashed border-brand-primary/30 p-4 text-xs text-[var(--muted)]">
        <p className="font-semibold text-brand-secondary">Operational Insights</p>
        <p>Kafka topics: transactions · notifications · fraud_alerts</p>
        <p>Latency budget: pushes &lt; 1.5 s · freeze &lt; 300 ms</p>
      </div>
    </aside>
  );
}

type LayoutProps = {
  children: ReactNode;
  rightColumn?: ReactNode;
  title: string;
  subtitle?: string;
};

export function Layout({ children, rightColumn, title, subtitle }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <Sidebar />
      <main className="flex w-full flex-1 flex-col gap-6 p-10">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-primary/70">{subtitle ?? 'MVP Orchestration'}</p>
          <h2 className="mt-2 text-3xl font-semibold text-brand-secondary">{title}</h2>
        </header>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="glass-panel shadow-panel rounded-3xl border border-[var(--border)] p-6">
            {children}
          </section>
          {rightColumn && (
            <aside className="flex flex-col gap-6">
              {rightColumn}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
