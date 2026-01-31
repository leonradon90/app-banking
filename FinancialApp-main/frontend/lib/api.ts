import { AuthSession, getStoredAuth, setStoredAuth } from './auth';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const WS_IDEMPOTENCY_HEADER = 'Idempotency-Key';

const generateIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export type RequestOptions<TBody = unknown> = {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: TBody;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  skipAuth?: boolean;
};

let refreshPromise: Promise<AuthSession | null> | null = null;

export async function refreshSession(): Promise<AuthSession | null> {
  if (refreshPromise) return refreshPromise;
  const current = getStoredAuth();
  if (!current?.refreshToken) return null;

  refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [WS_IDEMPOTENCY_HEADER]: generateIdempotencyKey(),
    },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  })
    .then(async (response) => {
      if (!response.ok) {
        if (response.status === 401) {
          setStoredAuth(null);
        }
        return null;
      }
      const payload = (await response.json()) as AuthSession;
      if (payload?.accessToken) {
        setStoredAuth(payload);
        return payload;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function apiRequest<TResponse = unknown, TBody = unknown>({
  path,
  method = 'GET',
  body,
  idempotencyKey,
  headers,
  skipAuth,
}: RequestOptions<TBody>): Promise<TResponse> {
  const session = skipAuth ? null : getStoredAuth();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    ...(method === 'POST'
      ? { [WS_IDEMPOTENCY_HEADER]: idempotencyKey ?? generateIdempotencyKey() }
      : {}),
    ...headers,
  };

  const runRequest = async (tokenOverride?: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...requestHeaders,
        ...(tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  let response = await runRequest();

  if (response.status === 401 && !skipAuth && session?.refreshToken) {
    const refreshed = await refreshSession();
    if (refreshed?.accessToken) {
      response = await runRequest(refreshed.accessToken);
    }
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = Array.isArray(errorPayload?.message)
      ? errorPayload.message.join(', ')
      : errorPayload?.message ?? errorPayload?.error ?? 'Unexpected API error';
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as TResponse;
  }

  return (await response.json()) as TResponse;
}
