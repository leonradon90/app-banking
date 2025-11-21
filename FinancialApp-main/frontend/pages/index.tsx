import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { apiRequest } from '../lib/api';

export default function Landing() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await apiRequest({
        path: '/auth/register',
        method: 'POST',
        body: { email, password },
      });
      setMessage('Registration successful – continue to the dashboard after verification.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-secondary via-brand-secondary to-brand-primary/60 p-10">
      <div className="glass-panel shadow-panel w-full max-w-5xl rounded-[32px] border border-white/30 p-12 text-white">
        <div className="grid gap-12 md:grid-cols-2">
          <section>
            <p className="badge bg-white/10 uppercase tracking-[0.3em] text-xs text-white/70">Aurora Banking Core</p>
            <h1 className="mt-6 text-4xl font-semibold leading-tight">
              Launch the MVP console that feels as fast as Revolut and as human as MONO.
            </h1>
            <p className="mt-4 text-sm text-white/70">
              Orchestrate accounts, real-time payments, card controls and notifications from a single operational cockpit.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4 text-xs text-white/60">
              <span className="rounded-full bg-white/10 px-4 py-2">Double-entry ledger first</span>
              <span className="rounded-full bg-white/10 px-4 py-2">Idempotent APIs</span>
              <span className="rounded-full bg-white/10 px-4 py-2">Kafka-native events</span>
            </div>
            <Link
              href="/dashboard"
              className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-secondary shadow-lg transition hover:shadow-xl"
            >
              Preview the operations console
            </Link>
          </section>
          <section className="rounded-3xl bg-white/10 p-8 backdrop-blur-xl">
            <h2 className="text-lg font-semibold">Create operator access</h2>
            <p className="mt-2 text-sm text-white/70">
              Registration mirrors the backend Auth/KYC flow. Credentials are persisted in PostgreSQL and governed via JWT.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleRegister}>
              <div>
                <label className="text-xs uppercase tracking-wide text-white/60">Work email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-white focus:outline-none"
                  placeholder="finops@aurora.finance"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-white/60">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-white focus:outline-none"
                  placeholder="Min. 8 characters"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand-secondary transition hover:shadow-lg disabled:cursor-not-allowed disabled:bg-white/60"
              >
                {isSubmitting ? 'Registering…' : 'Register & trigger KYC'}
              </button>
            </form>
            {message && <p className="mt-4 text-xs text-white/80">{message}</p>}
            <p className="mt-6 text-xs text-white/60">
              Already onboarded? <Link href="/dashboard" className="underline">Continue to console</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
