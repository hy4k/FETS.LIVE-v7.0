import { useEffect, useRef, useState } from "react";
import { agentRequest } from "./fets-ai-api";
export function useAgentResource<T>(
  userId: string,
  branch: string,
  action: string
) {
  const scope = `${userId}:${branch}`,
    latest = useRef(scope);
  latest.current = scope;
  const version = useRef(0);
  const [state, setState] = useState<{
    scope: string;
    data: T | null;
    loading: boolean;
    saving: boolean;
    error: string;
  }>({ scope, data: null, loading: true, saving: false, error: "" });
  const valid = (v: number) =>
    latest.current === scope && version.current === v;
  const load = async () => {
    const v = ++version.current;
    setState({ scope, data: null, loading: true, saving: false, error: "" });
    if (!userId) {
      setState({
        scope,
        data: null,
        loading: false,
        saving: false,
        error: "Sign in to continue.",
      });
      return;
    }
    try {
      const data = await agentRequest<T>({
        action,
        branch,
        page: "fets-intelligence",
      });
      if (valid(v))
        setState({ scope, data, loading: false, saving: false, error: "" });
    } catch (e) {
      if (valid(v))
        setState({
          scope,
          data: null,
          loading: false,
          saving: false,
          error: e instanceof Error ? e.message : "Could not load data.",
        });
    }
  };
  useEffect(() => {
    load();
    return () => {
      version.current++;
    };
  }, [scope, action]);
  const mutate = async <R>(
    body: Record<string, unknown>,
    apply?: (data: T, result: R) => T
  ) => {
    const v = version.current;
    if (state.saving || state.loading || !userId) return false;
    setState((old) => ({ ...old, saving: true, error: "" }));
    try {
      const result = await agentRequest<R>({
        ...body,
        branch,
        page: "fets-intelligence",
      });
      if (!valid(v)) return false;
      if (apply)
        setState((old) => ({
          ...old,
          saving: false,
          data: old.data ? apply(old.data, result) : old.data,
        }));
      else await load();
      return true;
    } catch (e) {
      if (valid(v))
        setState((old) => ({
          ...old,
          saving: false,
          error: e instanceof Error ? e.message : "Could not save.",
        }));
      return false;
    }
  };
  return {
    ...(state.scope === scope
      ? state
      : { scope, data: null, loading: true, saving: false, error: "" }),
    load,
    mutate,
  };
}
