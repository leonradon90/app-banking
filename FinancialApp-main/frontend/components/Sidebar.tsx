import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', description: 'Balances and recent activity' },
  { href: '/accounts', label: 'Accounts', description: 'Your wallets and balances' },
  { href: '/payments', label: 'Transfers', description: 'Send money securely' },
  { href: '/ledger', label: 'Transactions', description: 'Full transaction history' },
  { href: '/audit', label: 'Activity', description: 'Security and access log' },
  { href: '/card-controls', label: 'Cards', description: 'Freeze and set limits' },
  { href: '/notifications', label: 'Notifications', description: 'Alerts and preferences' },
  { href: '/limits', label: 'Limits', description: 'Spending rules and safety' },
  { href: '/kyc', label: 'Verification', description: 'Identity status and documents' },
];

const kycBadgeStyles: Record<string, string> = {
  VERIFIED: 'badge-green',
  REVIEW: 'badge-amber',
  PENDING: 'badge-amber',
  REJECTED: 'badge-red',
};

export function Sidebar() {
  const router = useRouter();
  const { session, logout } = useAuth();

  return (
    <aside className="relative z-10 flex h-full w-full max-w-xs flex-col gap-8 border-r border-white/60 bg-white/70 p-6 shadow-panel backdrop-blur-2xl">
      <div>
        <p className="tag bg-brand-primary/10 text-brand-primary">ALTX Finance</p>
        <h1 className="mt-3 text-2xl font-semibold text-brand-secondary">Everyday Banking</h1>
        {session && (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white/80 p-3 text-xs text-[var(--muted)]">
            <p className="font-semibold text-brand-secondary">{session.user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Verification</span>
              <span className={kycBadgeStyles[session.user.kycStatus] ?? 'badge-amber'}>
                {session.user.kycStatus}
              </span>
            </div>
          </div>
        )}
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
                  ? 'bg-white text-brand-secondary shadow-card ring-1 ring-brand-primary/30'
                  : 'hover:border-brand-primary/30 hover:bg-white/90'
              }`}
            >
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-xs text-[var(--muted)]">{description}</div>
            </Link>
          );
        })}
      </nav>
      {session && (
        <button
          type="button"
          onClick={logout}
          className="btn-outline"
        >
          Log out
        </button>
      )}
      <div className="mt-auto rounded-2xl border border-dashed border-brand-primary/30 bg-white/70 p-4 text-xs text-[var(--muted)]">
        <p className="font-semibold text-brand-secondary">Quick tips</p>
        <p>Keep notifications on for instant updates.</p>
        <p>Freeze your card instantly if it is misplaced.</p>
        <p>Review limits before large transfers.</p>
      </div>
    </aside>
  );
}

type LayoutProps = {
  children: ReactNode;
  rightColumn?: ReactNode;
  title: string;
  subtitle?: string;
  requireAuth?: boolean;
};

export function Layout({ children, rightColumn, title, subtitle, requireAuth = true }: LayoutProps) {
  const router = useRouter();
  const { session, isReady } = useAuth();
  const hasRightColumn = Boolean(rightColumn);

  useEffect(() => {
    if (requireAuth && isReady && !session) {
      router.push('/');
    }
  }, [requireAuth, isReady, session, router]);

  if (requireAuth && !session) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-12 h-80 w-80 rounded-full bg-brand-primary/15 blur-3xl" />
        <div className="glass-panel shadow-panel max-w-xl rounded-3xl border border-[var(--border)] p-8 text-center">
          <p className="tag bg-brand-primary/10 text-brand-primary">Secure access</p>
          <h2 className="mt-3 text-2xl font-semibold text-brand-secondary">Sign in to continue</h2>
          <p className="mt-3 text-sm text-[var(--muted)]">Please sign in to access your account.</p>
          <Link
            href="/"
            className="btn-primary mt-6"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[var(--bg)]">
      <div className="pointer-events-none absolute -right-28 -top-20 h-72 w-72 rounded-full bg-brand-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-brand-primary/15 blur-3xl" />
      <Sidebar />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col gap-6 p-10">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-primary/70">{subtitle ?? 'Overview'}</p>
          <h2 className="mt-2 text-3xl font-semibold text-brand-secondary">{title}</h2>
        </header>
        <div
          className={
            hasRightColumn
              ? 'grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'
              : 'grid min-w-0 gap-6'
          }
        >
          <section className="glass-panel shadow-panel animate-rise min-w-0 rounded-3xl border border-[var(--border)] p-6">
            {children}
          </section>
          {rightColumn && (
            <aside className="flex min-w-0 flex-col gap-6 animate-rise">
              {rightColumn}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
