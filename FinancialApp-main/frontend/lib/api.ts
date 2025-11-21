export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export type RequestOptions<TBody = unknown> = {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: TBody;
  idempotencyKey?: string;
  headers?: Record<string, string>;
};

export async function apiRequest<TResponse = unknown, TBody = unknown>({
  path,
  method = 'GET',
  body,
  idempotencyKey,
  headers,
}: RequestOptions<TBody>): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message ?? 'Unexpected API error');
  }

  return (await response.json()) as TResponse;
}
