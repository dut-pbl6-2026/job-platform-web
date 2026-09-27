import { QueryClient } from "@tanstack/react-query";

/** Week 6 Redis TTL for popular searches is 5 minutes — keep client cache in step. */
export const SEARCH_STALE_MS = 5 * 60 * 1000;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: SEARCH_STALE_MS,
        gcTime: SEARCH_STALE_MS * 2,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export const queryKeys = {
  allJobs: ["jobs"] as const,
  jobs: (params: unknown) => ["jobs", params] as const,
  job: (id: string) => ["job", id] as const,
  categories: ["categories"] as const,
  skills: (q: string) => ["skills", q] as const,
  locations: (q: string) => ["locations", q] as const,
};
