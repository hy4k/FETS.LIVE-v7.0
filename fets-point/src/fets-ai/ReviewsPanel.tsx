import { RefreshCw } from "lucide-react";
import { type ChangeReview } from "./fets-ai-api";
import { ReviewCard } from "./ReviewCard";
import { useAgentResource } from "./useAgentResource";

export function ReviewsPanel({ userId, branch }: { userId: string; branch: string }) {
  const resource = useAgentResource<{ reviews: ChangeReview[] }>(userId, branch, "reviews");
  const reviews = resource.data?.reviews || [];
  return (
    <section aria-label="Change reviews" className="space-y-4 text-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reviews</h2>
          <p className="mt-1 text-sm">Check each saved target and proposed change. Nothing is applied until you choose Apply. Some changes need final review in their module.</p>
        </div>
        <button type="button" disabled={resource.loading} onClick={() => void resource.load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">
          <RefreshCw aria-hidden size={15} />Refresh list
        </button>
      </div>
      {resource.loading && <p role="status" className="py-6 text-center text-sm">Loading your reviews…</p>}
      {resource.error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
        <p>{resource.error}</p>
        <button type="button" onClick={() => void resource.load()} className="mt-2 font-semibold underline">Retry reviews</button>
      </div>}
      {!resource.loading && !resource.error && reviews.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm">No reviews in this centre.</p>}
      {!resource.loading && !resource.error && reviews.map((review) => <ReviewCard key={`${userId}:${branch}:${review.id}`} review={review} scope={{ userId, branch }} />)}
    </section>
  );
}
