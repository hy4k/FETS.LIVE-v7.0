import { Check, ExternalLink } from "lucide-react";
import { type AgentReply, type HandoverProposal } from "./fets-ai-api";
import { offerHandoverDraft } from "./handover-draft";
import { ReviewCard, type ReviewScope } from "./ReviewCard";
const safePath = (path?: string) =>
  path?.startsWith("/") && !path.startsWith("//") ? path : undefined;
export function AgentResults({
  reply,
  navigate,
  onReview,
  reviewScope,
}: {
  reply: Partial<AgentReply>;
  navigate?: (page: string) => void;
  onReview?: (draft: HandoverProposal) => void;
  reviewScope?: ReviewScope;
}) {
  const jump = (page: string) => {
    if (navigate) {
      navigate(page);
      return;
    }
    const routes: Record<string, string> = {
      "fets-roster": "/roster",
      "fets-calendar": "/calendar",
      handover: "/shift",
    };
    if (!/^[a-z0-9-]+$/.test(page)) return;
    window.history.pushState(null, "", routes[page] || `/${page}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const review = (draft: HandoverProposal) => {
    if (onReview) {
      onReview(draft);
      return;
    }
    offerHandoverDraft(draft);
    window.dispatchEvent(
      new CustomEvent("fets-handover-draft", {
        detail: { branch: draft.branch, day: draft.day },
      })
    );
    jump("handover");
  };
  return (
    <div className="fets-ai-results space-y-2">
      {reply.model && (
        <small className="text-slate-500">
          {reply.provider || "Model"} · {reply.model}
        </small>
      )}
      {!!reply.evidence?.length && (
        <div className="fets-ai-evidence flex flex-wrap gap-2">
          {reply.evidence.map((ev, i) => (
            <div key={i}>
              <button
                type="button"
                className="text-xs rounded-lg bg-indigo-50 text-indigo-700 px-2 py-1"
                onClick={() => ev.page && jump(ev.page)}
                title={`${ev.count ?? 0} records · ${ev.fetchedAt}${
                  ev.truncated ? " · partial results" : ""
                }`}
              >
                <Check size={12} />
                {ev.source}
                {!ev.available
                  ? " unavailable"
                  : ev.truncated
                  ? " · partial"
                  : ""}
              </button>
              {ev.documents?.map((doc) => (
                <span className="block text-xs" key={doc.id}>
                  {doc.title} · v{doc.version} · {doc.id}
                  {doc.url?.startsWith("https://") && (
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      {" "}
                      Source
                    </a>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      {reply.actions?.map((action, i) => action.type === "change-review" ? (
        <ReviewCard key={action.id} review={action} scope={reviewScope} />
      ) : (
        <div
          key={i}
          className={`fets-ai-action fets-ai-action-${action.status} border rounded-xl p-3 text-sm`}
        >
          <strong>
            {action.title || action.tool.replace(/_/g, " ")} · {action.status}
          </strong>
          {action.recordId && <code className="block">{action.recordId}</code>}
          {action.message && <p>{action.message}</p>}
          {action.replayed && <small>Previously saved result</small>}
          {action.status === "succeeded" && safePath(action.path) && (
            <a className="block text-indigo-600" href={safePath(action.path)}>
              Open module <ExternalLink size={13} />
            </a>
          )}
        </div>
      ))}
      {reply.proposals?.map((proposal, i) =>
        proposal.type === "change-review" ? (
          <ReviewCard key={proposal.id} review={proposal} scope={reviewScope} />
        ) : proposal.type === "handover-draft" ? (
          <div className="fets-ai-proposal border rounded-xl p-3" key={i}>
            <strong>Handover draft · {proposal.day}</strong>
            <p>{proposal.summary}</p>
            <small>For review only. Nothing has been submitted.</small>
            <button type="button" onClick={() => review(proposal)}>
              Review in Handover
            </button>
          </div>
        ) : proposal.type === "navigation" ? (
          <button
            type="button"
            className="fets-ai-page-link"
            key={i}
            onClick={() => jump(proposal.page)}
          >
            Open {proposal.label}
            <ExternalLink size={13} />
          </button>
        ) : null
      )}
    </div>
  );
}
