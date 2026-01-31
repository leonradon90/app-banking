import { useState } from 'react';
import { Layout } from '../components/Sidebar';
import { apiRequest } from '../lib/api';

type CardControl = {
  id: number;
  accountId: number;
  cardToken: string;
  panLast4?: string;
  status: 'ACTIVE' | 'FROZEN';
  mccWhitelist: number[];
  geoWhitelist: string[];
  spendLimits: Record<string, unknown>;
};

export default function CardControls() {
  const [accountId, setAccountId] = useState('');
  const [cardToken, setCardToken] = useState('');
  const [pan, setPan] = useState('');
  const [selectedToken, setSelectedToken] = useState('');
  const [mccWhitelist, setMccWhitelist] = useState('');
  const [geoWhitelist, setGeoWhitelist] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [lastCard, setLastCard] = useState<CardControl | null>(null);

  const registerCard = async () => {
    setMessage(null);
    try {
      const response = await apiRequest<CardControl>({
        path: '/card-controls/register',
        method: 'POST',
        body: {
          accountId: Number(accountId),
          cardToken,
        },
      });
      setLastCard(response);
      setSelectedToken(response.cardToken);
      setMessage('Card added. You can now freeze it or set limits.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const tokenizeCard = async () => {
    setMessage(null);
    try {
      const response = await apiRequest<CardControl>({
        path: '/card-controls/tokenize',
        method: 'POST',
        body: {
          accountId: Number(accountId),
          pan,
        },
      });
      setLastCard(response);
      setSelectedToken(response.cardToken);
      setMessage('Card saved.');
      setPan('');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const freezeCard = async () => {
    setMessage(null);
    try {
      const response = await apiRequest<CardControl>({
        path: `/card-controls/${selectedToken}/freeze`,
        method: 'POST',
        body: { reason: 'user_request' },
      });
      setLastCard(response);
      setMessage('Card frozen.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const unfreezeCard = async () => {
    setMessage(null);
    try {
      const response = await apiRequest<CardControl>({
        path: `/card-controls/${selectedToken}/unfreeze`,
        method: 'POST',
      });
      setLastCard(response);
      setMessage('Card unfrozen.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const updateLimits = async () => {
    setMessage(null);
    const parsedMcc = mccWhitelist
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value));
    const parsedGeo = geoWhitelist
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    const spendLimits: Record<string, number> = {};
    if (dailyLimit) spendLimits.daily = Number(dailyLimit);
    if (monthlyLimit) spendLimits.monthly = Number(monthlyLimit);

    try {
      const response = await apiRequest<CardControl>({
        path: `/card-controls/${selectedToken}/limits`,
        method: 'PATCH',
        body: {
          ...(parsedMcc.length ? { mccWhitelist: parsedMcc } : {}),
          ...(parsedGeo.length ? { geoWhitelist: parsedGeo } : {}),
          ...(Object.keys(spendLimits).length ? { spendLimits } : {}),
        },
      });
      setLastCard(response);
      setMessage('Limits updated.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <Layout title="Your cards" subtitle="Cards">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <h3 className="section-title">Add a card</h3>
          <p className="text-sm text-[var(--muted)]">
            Link a card to an account so you can freeze it and set limits.
          </p>
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Account ID</label>
                <input
                  type="number"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  className="input-field mt-2"
                  placeholder="101"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Card token</label>
                <input
                  value={cardToken}
                  onChange={(event) => setCardToken(event.target.value)}
                  className="input-field mt-2"
                  placeholder="card_abc123"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={registerCard}
              className="btn-primary mt-6 w-full"
            >
              Add card
            </button>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
            <h4 className="text-sm font-semibold text-brand-secondary">Add by card number</h4>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Card numbers are tokenized and never stored in plain text.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Account ID</label>
                <input
                  type="number"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  className="input-field mt-2"
                  placeholder="101"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Card number</label>
                <input
                  value={pan}
                  onChange={(event) => setPan(event.target.value)}
                  className="input-field mt-2"
                  placeholder="4111 1111 1111 1111"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={tokenizeCard}
              disabled={!pan || !accountId}
              className="btn-outline mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save card
            </button>
          </div>
          {lastCard && (
            <div className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 text-sm text-[var(--muted)] shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide">Card token</p>
                  <p className="text-sm font-semibold text-brand-secondary">{lastCard.cardToken}</p>
                </div>
                <span className={lastCard.status === 'ACTIVE' ? 'badge-green' : 'badge-amber'}>
                  {lastCard.status}
                </span>
              </div>
              <p className="mt-3">Account: {lastCard.accountId}</p>
              <p className="mt-1">PAN last4: {lastCard.panLast4 || '-'}</p>
              <p className="mt-1">MCC whitelist: {lastCard.mccWhitelist?.join(', ') || '-'}</p>
              <p className="mt-1">Geo whitelist: {lastCard.geoWhitelist?.join(', ') || '-'}</p>
            </div>
          )}
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <h3 className="section-title">Controls</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Freeze a card instantly and set limits for safer spending.
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Card token</label>
              <input
                value={selectedToken}
                onChange={(event) => setSelectedToken(event.target.value)}
                className="input-field mt-2"
                placeholder="card_abc123"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={freezeCard}
                disabled={!selectedToken}
                className="btn-outline disabled:cursor-not-allowed disabled:opacity-60"
              >
                Freeze card
              </button>
              <button
                type="button"
                onClick={unfreezeCard}
                disabled={!selectedToken}
                className="btn-outline disabled:cursor-not-allowed disabled:opacity-60"
              >
                Unfreeze card
              </button>
            </div>
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-4">
              <p className="text-xs font-semibold text-brand-secondary">Limits</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Allowed categories (MCC)</label>
                  <input
                    value={mccWhitelist}
                    onChange={(event) => setMccWhitelist(event.target.value)}
                    className="input-field mt-2"
                    placeholder="5411, 5732"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Allowed countries</label>
                  <input
                    value={geoWhitelist}
                    onChange={(event) => setGeoWhitelist(event.target.value)}
                    className="input-field mt-2"
                    placeholder="US, GB, DE"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Daily limit</label>
                    <input
                      type="number"
                      value={dailyLimit}
                      onChange={(event) => setDailyLimit(event.target.value)}
                      className="input-field mt-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Monthly limit</label>
                    <input
                      type="number"
                      value={monthlyLimit}
                      onChange={(event) => setMonthlyLimit(event.target.value)}
                      className="input-field mt-2"
                    />
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={updateLimits}
              disabled={!selectedToken}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:bg-brand-primary/60"
            >
              Update limits
            </button>
            {message && <p className="text-xs text-brand-secondary">{message}</p>}
          </div>
        </section>
      </div>
    </Layout>
  );
}
