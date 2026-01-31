import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Layout } from '../components/Sidebar';
import { apiRequest } from '../lib/api';
import { useApiResource } from '../hooks/useApiResource';
import { getStoredAuth } from '../lib/auth';

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  status: string;
  createdAt?: string;
  created_at?: string;
  channels?: string[];
};

type PaginatedNotifications = {
  data: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type NotificationPreference = {
  channels: Record<string, boolean>;
};

const channelCatalog = [
  {
    id: 'push',
    title: 'Push notifications',
    latency: 'Instant',
    description: 'Real-time alerts delivered to your phone.',
  },
  {
    id: 'email',
    title: 'Email updates',
    latency: 'A few seconds',
    description: 'Backup confirmations and receipts sent to your inbox.',
  },
  {
    id: 'websocket',
    title: 'In-app alerts',
    latency: 'Instant',
    description: 'Live updates inside this app while you are signed in.',
  },
];

const fallbackPreferences: NotificationPreference = {
  channels: {
    push: true,
    email: true,
    websocket: true,
  },
};

const fallbackNotifications: PaginatedNotifications = {
  data: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

const statusStyles: Record<string, string> = {
  PENDING: 'badge-amber',
  SENT: 'badge-amber',
  DELIVERED: 'badge-green',
  READ: 'badge-green',
  FAILED: 'badge-red',
};

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function Notifications() {
  const { data: preferences, refresh: refreshPreferences } = useApiResource<NotificationPreference>({
    path: '/notifications/preferences',
    fallbackData: fallbackPreferences,
  });
  const { data: notifications, refresh: refreshNotifications } = useApiResource<PaginatedNotifications>({
    path: '/notifications?limit=10',
    fallbackData: fallbackNotifications,
    refreshInterval: 8000,
  });
  const { data: unreadCount, refresh: refreshUnread } = useApiResource<number>({
    path: '/notifications/unread/count',
    fallbackData: 0,
    refreshInterval: 8000,
  });
  const [channels, setChannels] = useState<Record<string, boolean>>(fallbackPreferences.channels);
  const [message, setMessage] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [deviceToken, setDeviceToken] = useState('');
  const [devicePlatform, setDevicePlatform] = useState('web');
  const isConnected = socket?.connected ?? false;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const session = getStoredAuth();
    if (!session?.accessToken) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';
    const connection = io(wsUrl, {
      auth: { token: session.accessToken },
      transports: ['websocket'],
    });

    connection.on('notification', () => {
      refreshNotifications();
      refreshUnread();
    });

    setSocket(connection);
    return () => {
      connection.disconnect();
      setSocket(null);
    };
  }, [refreshNotifications, refreshUnread]);

  useEffect(() => {
    if (preferences?.channels) {
      setChannels(preferences.channels);
    }
  }, [preferences]);

  const toggleChannel = async (channelId: string) => {
    const next = {
      ...channels,
      [channelId]: !channels[channelId],
    };
    setChannels(next);
    setMessage(null);
    try {
      await apiRequest({
        path: '/notifications/preferences',
        method: 'POST',
        body: { channels: next },
      });
      refreshPreferences();
      setMessage('Preferences saved.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const markAllRead = async () => {
    setMessage(null);
    try {
      await apiRequest({ path: '/notifications/read-all', method: 'PATCH' });
      refreshNotifications();
      refreshUnread();
      setMessage('All notifications marked as read.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const registerDevice = async () => {
    setMessage(null);
    try {
      await apiRequest({
        path: '/notifications/devices',
        method: 'POST',
        body: { token: deviceToken, platform: devicePlatform },
      });
      setMessage('Device connected.');
      setDeviceToken('');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <Layout title="Notifications" subtitle="Notifications">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="space-y-6">
          <div>
            <h3 className="section-title">Delivery channels</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Choose how you want to receive alerts.
            </p>
          </div>
          <div className="grid gap-4">
            {channelCatalog.map((channel) => (
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
                      channels[channel.id]
                        ? 'bg-brand-primary text-white shadow-lg'
                        : 'border border-[var(--border)] bg-white/80 text-brand-secondary'
                    }`}
                  >
                    {channels[channel.id] ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <article className="rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
            <p className="text-sm font-semibold text-brand-secondary">Connect a device</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Paste a device token to enable push alerts.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
              <input
                value={deviceToken}
                onChange={(event) => setDeviceToken(event.target.value)}
                placeholder="Device token"
                className="input-field text-xs"
              />
              <input
                value={devicePlatform}
                onChange={(event) => setDevicePlatform(event.target.value)}
                placeholder="Device type"
                className="input-field text-xs"
              />
            </div>
            <button
              type="button"
              onClick={registerDevice}
              disabled={!deviceToken}
              className="btn-primary mt-4 disabled:opacity-60"
            >
              Connect device
            </button>
          </article>
          {message && <p className="text-xs text-brand-secondary">{message}</p>}
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-white/90 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="section-title">Recent alerts</h3>
              <p className="text-xs text-[var(--muted)]">{unreadCount ?? 0} unread</p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount}
              className="btn-outline whitespace-nowrap disabled:opacity-60"
            >
              Mark all read
            </button>
          </div>
          {socket && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Live updates {isConnected ? 'enabled' : 'reconnecting'}.
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {(notifications?.data ?? []).length === 0 ? (
              <li className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-4 text-xs text-[var(--muted)]">
                No alerts yet. Make a transfer to see notifications here.
              </li>
            ) : (
              notifications?.data.map((notification) => (
                <li key={notification.id} className="rounded-2xl border border-[var(--border)] bg-white/80 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-brand-secondary">{notification.title}</p>
                      <p className="text-xs text-[var(--muted)] break-words">{notification.message}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {formatLabel(notification.type)} -{' '}
                        {new Date(notification.createdAt ?? notification.created_at ?? new Date().toISOString()).toLocaleString()}
                      </p>
                    </div>
                    <span className={statusStyles[notification.status] ?? 'badge-amber'}>
                      {formatLabel(notification.status)}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </Layout>
  );
}
