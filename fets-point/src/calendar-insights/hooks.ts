import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { fetchInsightData } from "./data";
import type { InsightData, InsightRange } from "./types";

export function useCalendarInsights(
  range: InsightRange | null,
  branch: string
) {
  const { user } = useAuth();
  const client = useQueryClient();
  const identity = user?.id || null;
  const previousIdentity = useRef(identity);
  useEffect(() => {
    if (previousIdentity.current !== identity && previousIdentity.current) {
      client.removeQueries({
        queryKey: ["calendar-insights", previousIdentity.current],
      });
    }
    previousIdentity.current = identity;
  }, [client, identity]);
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ["sessions", "calendar"] });
      void client.invalidateQueries({ queryKey: ["seat-context"] });
      void client.invalidateQueries({ queryKey: ["calendar-insights"] });
    };
    window.addEventListener("fets-data-loaded", refresh);
    return () => window.removeEventListener("fets-data-loaded", refresh);
  }, [client]);
  return useQuery<InsightData, Error>({
    queryKey: [
      "calendar-insights",
      identity,
      branch,
      range?.from,
      range?.through,
      range?.previousFrom,
      range?.previousThrough,
    ],
    enabled:
      !!identity && !!range && ["calicut", "cochin", "global"].includes(branch),
    queryFn: async ({ signal }) => {
      if (!identity || !range)
        throw new Error("Choose a signed-in Calendar report scope.");
      const data = await fetchInsightData(range, branch);
      if (signal.aborted)
        throw new Error("Calendar insights request was cancelled.");
      return data;
    },
    // Never carry another identity/centre/range into the next query. React
    // Query retains current data only during refreshes of this exact key.
    placeholderData: undefined,
    staleTime: 10000,
    refetchOnMount: "always",
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
