import { useState, useEffect, useCallback } from 'react';

// Global cache to persist data across component unmounts
export const queryCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes hard expiry

export function useQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 60_000, // 60s: don't refetch if cache is fresher than this
}: {
  queryKey: any[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number; // ms before cached data is considered stale
}) {
  const key = JSON.stringify(queryKey);
  
  const [data, setData] = useState<T | undefined>(queryCache[key]?.data);
  const [isLoading, setIsLoading] = useState<boolean>(!queryCache[key]?.data && enabled);
  
  const refetch = useCallback(async () => {
    // Show spinner only if we have no data at all
    if (!queryCache[key]?.data) {
      setIsLoading(true);
    }
    try {
      const result = await queryFn();
      queryCache[key] = { data: result, timestamp: Date.now() };
      setData(result);
      return result;
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [key, queryFn]);
  
  useEffect(() => {
    if (!enabled) return;
    
    const cached = queryCache[key];
    if (cached) {
      // Always show cached data immediately (stale-while-revalidate)
      setData(cached.data);
      
      const age = Date.now() - cached.timestamp;
      if (age > staleTime) {
        // Data is stale — background refetch (no spinner since we already have data)
        refetch();
      }
      // else: data is fresh — skip the network call entirely
    } else {
      // No cache at all — fetch now (with spinner)
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]); // Purposefully omit refetch/staleTime to prevent infinite loops
  
  return { data, isLoading, refetch };
}
