import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { fetchOutreachContext, fetchOutreachDetail } from "./api";
export function useOutreachContext() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["outreach", user?.id, "context"],
    enabled: !!user?.id,
    queryFn: fetchOutreachContext,
    staleTime: 15000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
export function useOutreachDetail(id: string | null) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["outreach", user?.id, "detail", id],
    enabled: !!user?.id && !!id,
    initialPageParam: null as { at: string; id: string } | null,
    queryFn: ({ pageParam }) => fetchOutreachDetail(id!, pageParam),
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
    staleTime: 15000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
