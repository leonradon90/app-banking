import useSWR from 'swr';
import { apiRequest } from '../lib/api';

type UseApiResourceOptions<T> = {
  path: string;
  fallbackData?: T;
};

export function useApiResource<T>({ path, fallbackData }: UseApiResourceOptions<T>) {
  const { data, error, isLoading, mutate } = useSWR<T>(
    path,
    async (key: string) => apiRequest<T>({ path: key }),
    {
      fallbackData,
      revalidateOnFocus: false,
    }
  );

  return {
    data,
    error,
    isLoading,
    refresh: () => mutate(),
  } as const;
}
