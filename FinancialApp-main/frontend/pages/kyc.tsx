import { useMemo, useState } from 'react';
import { Layout } from '../components/Sidebar';

interface Applicant {
  id: number;
  email: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVIEW';
  submittedAt: string;
  country: string;
}

const applicants: Applicant[] = [
  { id: 81, email: 'amy@aurora.finance', status: 'PENDING', submittedAt: '2024-04-15T08:40:00Z', country: 'UK' },
  { id: 82, email: 'dan@aurora.finance', status: 'VERIFIED', submittedAt: '2024-04-14T18:12:00Z', country: 'DE' },
  { id: 83, email: 'li@aurora.finance', status: 'REVIEW', submittedAt: '2024-04-15T10:20:00Z', country: 'SG' },
];

const statusStyles: Record<Applicant['status'], string> = {
  PENDING: 'badge-amber',
  VERIFIED: 'badge-green',
  REJECTED: 'badge-red',
  REVIEW: 'badge-amber',
};

export default function Kyc() {
  const [filter, setFilter] = useState<Applicant['status'] | 'ALL'>('ALL');

  const filtered = useMemo(
    () => applicants.filter((applicant) => (filter === 'ALL' ? true : applicant.status === filter)),
    [filter]
  );

  return (
    <Layout title="Identity verification" subtitle="KYC">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="section-title">Applicants</h3>
              <p className="text-sm text-[var(--muted)]">Asynchronous KYC – cards issued with limits until verification.</p>
            </div>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Applicant['status'] | 'ALL')}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-xs focus:border-brand-primary focus:outline-none"
            >
              <option value="ALL">All states</option>
              <option value="PENDING">Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="REVIEW">Review</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="grid gap-4">
            {filtered.map((applicant) => (
              <article key={applicant.id} className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-brand-secondary">{applicant.email}</p>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Submitted {new Date(applicant.submittedAt).toLocaleString()}</p>
                  </div>
                  <span className={statusStyles[applicant.status]}>{applicant.status}</span>
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">Country: {applicant.country}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Provider: SumSub sandbox. Results streamed back via webhook → KYC service → Accounts.
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Flow</h3>
          <ol className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            <li>1. User submits selfie + document (mobile app) – optimistic access granted.</li>
            <li>2. KYC provider pushes webhook → /api/v1/kyc/callback with verification status.</li>
            <li>3. Accounts service updates limits; Notifications service sends contextual push.</li>
            <li>4. Audit log captures the event with payload snapshot.</li>
            <li>5. Manual review queue handled within this console.</li>
          </ol>
          <div className="mt-6 rounded-2xl border border-dashed border-brand-primary/40 bg-brand-primary/5 p-4 text-xs text-brand-secondary">
            UX benchmark: MONO verifies in ~60 seconds. We match this by streaming provider updates directly to Kafka.
          </div>
        </section>
      </div>
    </Layout>
  );
}
