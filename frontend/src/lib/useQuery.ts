import { useState, useEffect, useCallback } from 'react';

// Global cache to persist data across component unmounts
const queryCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export function useQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
}: {
  queryKey: any[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
}) {
  const key = JSON.stringify(queryKey);
  
  const [data, setData] = useState<T | undefined>(queryCache[key]?.data);
  const [isLoading, setIsLoading] = useState<boolean>(!queryCache[key]?.data && enabled);
  
  const refetch = useCallback(async () => {
    // Only set loading if we don't have data (stale-while-revalidate pattern)
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
      setData(cached.data);
      // Background refetch always triggered to ensure fresh data on revisit, 
      // matching the "whenever i revisit it fetches data" requirement
      refetch();
    } else {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]); // We purposefully omit queryFn to prevent infinite loops if it's redefined inline
  
  return { data, isLoading, refetch };
}
