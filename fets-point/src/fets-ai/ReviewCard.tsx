import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { agentRequest, type ChangeReview } from "./fets-ai-api";

export type ReviewScope = { userId: string; branch: string };
type ReviewState = {
  scope: string;
  review: ChangeReview | null;
  busy: "apply" | "cancel" | "refresh" | null;
  error: string;
  uncertain: boolean;
};
const safePath = (path: string) =>
  path.startsWith("/") && !path.startsWith("//") && !/[\\\u0000-\u0020]/.test(path)
    ? path
    : undefined;
const matchesCentre = (review: ChangeReview, branch: string) =>
  review.branch === branch || ["global", "all", "shared"].includes(review.branch);
const valueText = (value: unknown, exists: boolean) => {
  if (!exists) return "Not set";
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value || "Empty";
  return JSON.stringify(value, null, 2) ?? "Not set";
};
const labels: Record<ChangeReview["status"], string> = {
  pending: "Awaiting your review",
  applied: "Applied",
  cancelled: "Cancelled",
  expired: "Expired",
  stale: "Changed since preview",
  blocked: "Not permitted",
};

export function ReviewCard({ review: input, scope, onChange }: {
  review: ChangeReview;
  scope?: ReviewScope;
  onChange?: (review: ChangeReview) => void;
}) {
  const scopeKey = `${scope?.userId || ""}:${scope?.branch || ""}`;
  const headingId = useId();
  const latest = useRef(scopeKey);
  latest.current = scopeKey;
  const version = useRef(0);
  const locked = useRef(false);
  const previous = useRef({ scope: scopeKey, input });
  const [state, setState] = useState<ReviewState>({
    scope: scopeKey, review: input, busy: null, error: "", uncertain: false,
  });
  const [now, setNow] = useState(Date.now);
  const current = (v: number) => latest.current === scopeKey && version.current === v;
  const accept = (review: ChangeReview) => {
    if (review?.type !== "change-review" || review.id !== input.id ||
      (scope && !matchesCentre(review, scope.branch))) {
      throw new Error("This review is not available for the selected centre.");
    }
    return review;
  };
  const refresh = async () => {
    if (!scope?.userId || locked.current || !matchesCentre(input, scope.branch)) return;
    const v = ++version.current;
    locked.current = true;
    setState((old) => ({ ...old, scope: scopeKey, busy: "refresh", error: "" }));
    try {
      const data = await agentRequest<{ review: ChangeReview }>({
        action: "review", reviewId: input.id, branch: scope.branch, page: "fets-intelligence",
      });
      if (!current(v)) return;
      const review = accept(data.review);
      setState({ scope: scopeKey, review, busy: null, error: "", uncertain: false });
      onChange?.(review);
    } catch (error) {
      if (current(v)) setState((old) => ({
        ...old, busy: null, uncertain: true,
        error: error instanceof Error ? error.message : "Could not refresh this review.",
      }));
    } finally {
      if (current(v)) locked.current = false;
    }
  };
  useEffect(() => {
    const changedScope = previous.current.scope !== scopeKey;
    const changedInput = previous.current.input !== input;
    previous.current = { scope: scopeKey, input };
    if (changedScope) {
      version.current++;
      locked.current = false;
      setState({ scope: scopeKey, review: null, busy: null, error: "", uncertain: true });
      if (scope?.userId && matchesCentre(input, scope.branch)) void refresh();
    } else if (changedInput && (!locked.current || input.id !== state.review?.id)) {
      version.current++;
      locked.current = false;
      setState({ scope: scopeKey, review: input, busy: null, error: "", uncertain: false });
    }
  }, [scopeKey, input]);
  useEffect(() => () => { version.current++; }, []);
  const review = state.scope === scopeKey ? state.review : null;
  useEffect(() => {
    if (!review || review.status !== "pending") return;
    const remaining = Date.parse(review.expiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(remaining + 1, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [review, state.busy, now]);

  const decide = async (decision: "apply" | "cancel") => {
    if (!review || !scope?.userId || locked.current || state.uncertain ||
      !matchesCentre(review, scope.branch) || review.status !== "pending" ||
      !(Date.parse(review.expiresAt) > Date.now()) ||
      (decision === "apply" && review.applyMode !== "database")) return;
    const v = ++version.current;
    locked.current = true;
    setState((old) => ({ ...old, busy: decision, error: "" }));
    try {
      const data = await agentRequest<{ review: ChangeReview }>({
        action: "review-decide", reviewId: review.id, decision,
        branch: scope.branch, page: "fets-intelligence",
      });
      if (!current(v)) return;
      const confirmed = accept(data.review);
      setState({ scope: scopeKey, review: confirmed, busy: null, error: "", uncertain: false });
      onChange?.(confirmed);
    } catch (error) {
      if (current(v)) setState((old) => ({
        ...old, busy: null, uncertain: true,
        error: `${error instanceof Error ? error.message : "Could not confirm this decision."} Refresh the review to confirm its current status before deciding again.`,
      }));
    } finally {
      if (current(v)) locked.current = false;
    }
  };
  const centreMatches = !scope || matchesCentre(input, scope.branch);
  const error = state.scope === scopeKey ? state.error : "";
  if (!review || !centreMatches) return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <p role="status">{!centreMatches ? "This review belongs to a different selected centre." : "Checking review access…"}</p>
      {error && <p role="alert" className="mt-2 text-rose-700">{error}</p>}
      {centreMatches && scope?.userId && <button type="button" disabled={!!state.busy} className="mt-2 underline disabled:opacity-50" onClick={() => void refresh()}>Refresh review</button>}
    </div>
  );
  const expired = review.status === "pending" && !(Date.parse(review.expiresAt) > Date.now());
  const status = expired ? "expired" : review.status;
  const canDecide = !!scope?.userId && !state.busy && !state.uncertain;
  const fields = [...new Set([...Object.keys(review.before), ...Object.keys(review.proposed)])];
  return (
    <section aria-labelledby={headingId} aria-busy={!!state.busy} className="fets-ai-review rounded-xl border border-indigo-200 bg-white p-3 text-sm text-slate-700 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={headingId} className="font-semibold text-slate-900">{review.label}</h3>
        <span role="status" className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800">{labels[status]}</span>
      </div>
      <p>{review.summary}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-500">Module</dt><dd>{review.module}</dd>
        <dt className="text-slate-500">Centre</dt><dd>{review.branch}</dd>
        <dt className="text-slate-500">Target ID</dt><dd className="break-all">{review.recordId || "No existing record ID supplied"}</dd>
        <dt className="text-slate-500">Review ID</dt><dd className="break-all">{review.id}</dd>
      </dl>
      <p className="text-xs text-slate-500">Expires <time dateTime={review.expiresAt}>{Number.isFinite(Date.parse(review.expiresAt)) ? new Date(review.expiresAt).toLocaleString() : "Unavailable"}</time></p>
      <div className="space-y-2" aria-label="Proposed changes">
        {fields.map((field) => (
          <div key={field} className="rounded-lg border border-slate-200 overflow-hidden">
            <p className="bg-slate-50 px-2 py-1 text-xs font-semibold break-words">{field.replace(/_/g, " ")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
              <div><span className="block text-xs text-slate-500">Original</span><pre className="whitespace-pre-wrap break-words font-sans text-sm">{valueText(review.before[field], Object.prototype.hasOwnProperty.call(review.before, field))}</pre></div>
              <div><span className="block text-xs text-indigo-600">Proposed</span><pre className="whitespace-pre-wrap break-words font-sans text-sm">{valueText(review.proposed[field], Object.prototype.hasOwnProperty.call(review.proposed, field))}</pre></div>
            </div>
          </div>
        ))}
      </div>
      {review.applyMode === "module" && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">Not applied; review in module. Complete the final steps in {review.module}.</p>}
      {status === "pending" && review.applyMode === "database" && <p className="text-xs">Nothing has been applied. Review the target and values before choosing Apply.</p>}
      {status === "stale" && <p>Ask for a new preview. The saved target changed, so this review cannot be applied.</p>}
      {status === "expired" && <p>Ask for a new preview. This review has expired.</p>}
      {status === "blocked" && <p>This change is not permitted. Check your current access or ask an administrator.</p>}
      {review.result?.message && <p>{review.result.message}</p>}
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-rose-800">{error}</p>}
      {!scope?.userId && status === "pending" && <p>Open Reviews from your signed-in workspace to decide on this change.</p>}
      <div className="flex flex-wrap gap-2">
        {status === "pending" && review.applyMode === "database" && <button type="button" disabled={!canDecide} onClick={() => void decide("apply")} className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{state.busy === "apply" ? "Applying…" : "Apply change"}</button>}
        {status === "pending" && <button type="button" disabled={!canDecide} onClick={() => void decide("cancel")} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold disabled:opacity-50">{state.busy === "cancel" ? "Cancelling…" : "Cancel review"}</button>}
        {review.applyMode === "module" && safePath(review.path) && <a className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-2 text-indigo-700" href={safePath(review.path)}>Review in {review.module}<ExternalLink aria-hidden size={13} /></a>}
        {!!scope?.userId && <button type="button" disabled={!!state.busy} onClick={() => void refresh()} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-slate-600 disabled:opacity-50"><RefreshCw aria-hidden size={13} />{state.busy === "refresh" ? "Refreshing…" : "Refresh review"}</button>}
      </div>
    </section>
  );
}
