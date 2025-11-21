import { useState } from 'react';
import { Layout } from '../components/Sidebar';

const mockChannels = [
  {
    id: 'push',
    title: 'Push (Firebase)',
    latency: '0.9 s avg',
    description: 'Realtime mobile notifications triggered by Kafka → Notifications service → FCM.',
  },
  {
    id: 'email',
    title: 'Email (Sendgrid)',
    latency: '3.1 s avg',
    description: 'Transactional email with HMAC-signed payloads and templated receipts.',
  },
  {
    id: 'websocket',
    title: 'WebSocket',
    latency: '0.4 s avg',
    description: 'Browser dashboard streaming via Kafka consumer + Socket gateway.',
  },
];

export default function Notifications() {
  const [selection, setSelection] = useState(['push', 'websocket']);

  const toggleChannel = (channelId: string) => {
    setSelection((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  return (
    <Layout title="Push center" subtitle="Notifications">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="space-y-6">
          <div>
            <h3 className="section-title">Channels</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Inspired by MONO & Revolut – instant, contextual, and configurable per customer.
            </p>
          </div>
          <div className="grid gap-4">
            {mockChannels.map((channel) => (
              <article key={channel.id} className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-sm font-semibold text-brand-secondary">{channel.title}</p>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Latency {channel.latency}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">{channel.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleChannel(channel.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      selection.includes(channel.id)
                        ? 'bg-brand-primary text-white shadow-lg'
                        : 'border border-[var(--border)] bg-white/80 text-brand-secondary'
                    }`}
                  >
                    {selection.includes(channel.id) ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Delivery choreography</h3>
          <ol className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            <li>1. Domain services publish events → Kafka topics (transactions, notifications, fraud_alerts).</li>
            <li>2. Notifications service consumes with fan-out workers per channel.</li>
            <li>3. Preference resolver uses Redis cache + PostgreSQL JSON column.</li>
            <li>4. Delivery adapters (Firebase, Sendgrid, WebSocket) dispatch within SLA budgets.</li>
            <li>5. Audit log records delivery attempt + response payloads.</li>
          </ol>
          <div className="mt-6 rounded-2xl border border-dashed border-brand-primary/40 bg-brand-primary/5 p-4 text-xs text-brand-secondary">
            TRANSACTION_SUCCESS → push "You sent $250 to Tom Hardy" in 0.9 s average. Soft declines escalate to in-app inbox.
          </div>
        </section>
      </div>
    </Layout>
  );
}
