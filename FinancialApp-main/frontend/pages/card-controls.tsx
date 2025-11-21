import { useState } from 'react';
import { Layout } from '../components/Sidebar';
import { apiRequest } from '../lib/api';

const mockCards = [
  {
    id: '5246-••••-••••-9081',
    alias: 'Founder card',
    status: 'ACTIVE',
    limits: {
      daily: 5000,
      online: 1500,
      mcc: ['5411 Groceries', '5732 Electronics'],
    },
    geoFence: 'EU & UK',
  },
  {
    id: '4478-••••-••••-1223',
    alias: 'Ops team',
    status: 'FROZEN',
    limits: {
      daily: 1200,
      online: 600,
      mcc: ['5814 Fast food'],
    },
    geoFence: 'UA & EU',
  },
];

export default function CardControls() {
  const [cardId, setCardId] = useState('5246-••••-••••-9081');
  const [limit, setLimit] = useState('5000');
  const [status, setStatus] = useState<'ACTIVE' | 'FROZEN'>('ACTIVE');
  const [message, setMessage] = useState<string | null>(null);

  const handleUpdate = async () => {
    setMessage(null);
    try {
      await apiRequest({
        path: '/api/v1/card-controls',
        method: 'POST',
        body: {
          card_id: cardId,
          status,
          limit_daily: Number(limit),
        },
      });
      setMessage('Control update propagated. CARD_CONTROL_UPDATED event dispatched to Kafka.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <Layout title="Card orchestration" subtitle="Card Controls">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <h3 className="section-title">Portfolio</h3>
          <div className="grid gap-4">
            {mockCards.map((card) => (
              <article key={card.id} className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{card.alias}</p>
                    <p className="text-xl font-semibold text-brand-secondary">{card.id}</p>
                  </div>
                  <span className={`badge ${card.status === 'ACTIVE' ? 'badge-green' : 'badge-amber'}`}>{card.status}</span>
                </div>
                <div className="mt-4 grid gap-2 text-xs text-[var(--muted)]">
                  <p>Daily limit: ${card.limits.daily.toLocaleString()}</p>
                  <p>Online limit: ${card.limits.online.toLocaleString()}</p>
                  <p>MCC allowed: {card.limits.mcc.join(', ')}</p>
                  <p>Geo restrictions: {card.geoFence}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Update control</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            300 ms target for freeze/unfreeze to hit the authorisation gateway before the next swipe.
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Card</label>
              <select
                value={cardId}
                onChange={(event) => setCardId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
              >
                {mockCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.alias}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Daily limit</label>
                <input
                  type="number"
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Status</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'FROZEN')}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm focus:border-brand-primary focus:outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="FROZEN">Frozen</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUpdate}
              className="w-full rounded-2xl bg-brand-primary px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
            >
              Apply control update
            </button>
            {message && <p className="text-xs text-brand-secondary">{message}</p>}
          </div>
        </section>
      </div>
    </Layout>
  );
}
