import { useCallback } from 'react';
import useSWR from 'swr';
import { apiRequest } from '../lib/api';
import { getStoredAuth } from '../lib/auth';

type UseApiResourceOptions<T> = {
  path: string;
  fallbackData?: T;
  requireAuth?: boolean;
  refreshInterval?: number;
};

export function useApiResource<T>({
  path,
  fallbackData,
  requireAuth = true,
  refreshInterval,
}: UseApiResourceOptions<T>) {
  const hasSession = typeof window !== 'undefined' && !!getStoredAuth()?.accessToken;
  const shouldFetch = typeof window !== 'undefined' && (!requireAuth || hasSession);
  const swrKey = shouldFetch ? path : null;

  const { data, error, isLoading, mutate } = useSWR<T>(
    swrKey,
    async (key: string) => apiRequest<T>({ path: key }),
    {
      fallbackData,
      revalidateOnFocus: false,
      refreshInterval,
    }
  );

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    data,
    error,
    isLoading,
    refresh,
  } as const;
}
