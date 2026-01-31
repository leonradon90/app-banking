import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

export default function Landing() {
  const router = useRouter();
  const { login, register, session } = useAuth();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      if (mode === 'register') {
        await register(email, password);
        setMessage('Account created. You can continue while verification runs.');
      } else {
        await login(email, password);
        setMessage('Welcome back. Loading your account...');
      }
      setTimeout(() => {
        router.push('/dashboard');
      }, 600);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-secondary p-10 text-white">
      <div className="pointer-events-none absolute -right-32 -top-24 h-80 w-80 rounded-full bg-brand-accent/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-96 w-96 rounded-full bg-brand-primary/30 blur-3xl" />
      <div className="glass-panel shadow-panel w-full max-w-5xl rounded-[32px] border border-white/30 p-12">
        <div className="grid gap-12 md:grid-cols-2">
          <section className="rounded-3xl bg-brand-secondary/80 p-8 text-white shadow-inner">
            <p className="tag bg-white/15 text-white/80">ALTX Finance</p>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-white">Banking that moves at the speed of life.</h1>
            <p className="mt-4 text-sm text-white/80">
              Open accounts, send transfers, and stay in control with instant alerts and smart limits.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4 text-xs text-white/70">
              <span className="rounded-full bg-white/15 px-4 py-2">Instant transfers</span>
              <span className="rounded-full bg-white/15 px-4 py-2">Card controls</span>
              <span className="rounded-full bg-white/15 px-4 py-2">Real-time alerts</span>
            </div>
            <Link
              href="/dashboard"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-secondary shadow-lg transition hover:shadow-xl"
            >
              Open the app
            </Link>
          </section>
          <section className="rounded-3xl bg-white/95 p-8 text-brand-secondary shadow-lg backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {mode === 'register'
                    ? 'Sign up to get started. Verification runs in the background.'
                    : 'Sign in to continue to your account.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                className="btn-outline"
              >
                {mode === 'register' ? 'Use sign in' : 'Create account'}
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleAuth}>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input-field mt-2 text-brand-secondary placeholder:text-[var(--muted)]"
                  placeholder="you@altx.finance"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input-field mt-2 text-brand-secondary placeholder:text-[var(--muted)]"
                  placeholder="At least 8 characters"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting
                  ? mode === 'register'
                    ? 'Creating account...'
                    : 'Signing in...'
                  : mode === 'register'
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </form>
            {message && <p className="mt-4 text-xs text-[var(--muted)]">{message}</p>}
            {session && (
              <p className="mt-6 text-xs text-[var(--muted)]">
                Signed in as {session.user.email}.{' '}
                <Link href="/dashboard" className="underline">
                  Continue to your account
                </Link>
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
