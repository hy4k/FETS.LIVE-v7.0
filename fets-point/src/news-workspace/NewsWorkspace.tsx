import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  FileText,
  Inbox,
  Mail,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useBranch } from "../hooks/useBranch";
import { repository as live, type Repository } from "./repository";
import {
  branches,
  kinds,
  emptyDocument,
  expired,
  needsRead,
  visiblePosts,
  validate,
  safeLink,
  istInput,
  localInput,
  type Post,
  type Draft,
  type Document,
  type Source,
  type Receipt,
} from "./model";
import "./news.css";
const date = (v: string) =>
  new Date(v).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const stamp = (v: string) =>
  new Date(v).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Could not complete this request.";
export default function NewsWorkspace({
  repository = live,
}: {
  repository?: Repository;
}) {
  const { profile } = useAuth();
  const { activeBranch } = useBranch();
  const me = profile?.id || "";
  const [context, setContext] = useState<Awaited<
      ReturnType<Repository["context"]>
    > | null>(null),
    [feed, setFeed] = useState<Awaited<ReturnType<Repository["feed"]>>>({
      posts: [],
      receipts: [],
      legacy: [],
    }),
    [review, setReview] = useState<Awaited<ReturnType<Repository["review"]>>>({
      drafts: [],
      sources: [],
      runs: [],
      people: [],
    });
  const [view, setView] = useState("all"),
    [search, setSearch] = useState(""),
    [client, setClient] = useState(""),
    [branch, setBranch] = useState<string>(
      typeof activeBranch === "string" ? activeBranch : "global",
    ),
    [selected, setSelected] = useState<Post | null>(null),
    [edit, setEdit] = useState<{
      draft: Draft | null;
      document: Document;
    } | null>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0),
    [hasMore, setHasMore] = useState(false);
  const [domainDraft, setDomainDraft] = useState<string | null>(null);
  const seq = useRef(0),
    saving = useRef(false);
  const canReview = context?.config.can_review === true;
  const load = useCallback(async () => {
    const id = ++seq.current;
    try {
      const c = await repository.context();
      const f = await repository.feed();
      const r = c.config.can_review
        ? await repository.review()
        : { drafts: [], sources: [], runs: [], people: [] };
      if (id !== seq.current) return;
      setContext(c);
      setFeed(f);
      setReview(r);
      setPage(0);
      setHasMore(f.posts.length === 100);
      setError("");
    } catch (e) {
      if (id === seq.current) setError(message(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [repository]);
  useEffect(() => {
    void load();
    const tick = setInterval(() => {
      if (!saving.current && document.visibilityState === "visible")
        void load();
    }, 60000);
    return () => {
      seq.current++;
      clearInterval(tick);
    };
  }, [load]);
  useEffect(() => {
    setBranch(typeof activeBranch === "string" ? activeBranch : "global");
    setSelected(null);
  }, [activeBranch]);
  async function run(f: () => Promise<unknown>, success = "", refresh = true) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setNotice("");
    seq.current++;
    try {
      await f();
      if (refresh) await load();
      if (success) setNotice(success);
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const catalogue = context || { clients: [], programmes: [] };
  const clientName = (id: string) =>
    catalogue.clients.find((c) => c.id === id)?.name || "";
  const programmeName = (id: string) =>
    catalogue.programmes.find((p) => p.id === id)?.name || "";
  const posts = visiblePosts(feed.posts, feed.receipts, me, {
    branch,
    client,
    search,
    view,
  });
  const awaiting = feed.posts
    .filter(
      (p) =>
        ["global", "all"].includes(branch) ||
        p.document.branch === branch ||
        p.document.branch === "global",
    )
    .filter((p) => needsRead(p, feed.receipts, me)).length;
  const queue = review.drafts.filter((d) => d.status !== "rejected");
  const sourceFor = (d: Draft | null) =>
    review.sources.find((s) => s.id === d?.source_id);
  const currentPost = selected
    ? feed.posts.find((p) => p.id === selected.id) || selected
    : null;
  function openDraft(d: Draft | null) {
    setEdit({
      draft: d,
      document: structuredClone(d?.document || emptyDocument()),
    });
    setSelected(null);
    setError("");
    setNotice("");
  }
  async function save() {
    if (!edit) return;
    const issues = validate(edit.document, edit.draft?.kind || "internal");
    if (issues.length) {
      setError(issues.join(" "));
      return;
    }
    await run(async () => {
      const d = await repository.save(edit.document, edit.draft);
      setEdit({ draft: d, document: structuredClone(d.document) });
    }, "Draft saved. Staff cannot see it until you approve it.");
  }
  function metadata(p: Post) {
    return (
      <div className="fn-meta">
        <span className={`fn-kind is-${p.kind}`}>{kinds[p.kind]}</span>
        {clientName(p.document.client_id) && (
          <span>
            {clientName(p.document.client_id)}
            {programmeName(p.document.programme_id) &&
              ` · ${programmeName(p.document.programme_id)}`}
          </span>
        )}
        <span>{branches[p.document.branch]}</span>
        <span>Source {date(p.source_date || p.published_at)}</span>
      </div>
    );
  }
  function SourcePanel({ source }: { source: Source | undefined }) {
    return source ? (
      <section className="fn-source">
        <h3>Original source</h3>
        <p>
          <strong>{source.source_label}</strong> · {date(source.source_date)}
        </p>
        <p className="fn-muted">{source.verification}</p>
        <pre>{source.excerpt}</pre>
        {safeLink(source.private_reference || source.public_url) && (
          <a
            target="_blank"
            rel="noreferrer"
            href={safeLink(source.private_reference || source.public_url)!}
          >
            Open original {source.kind === "client" ? "email" : "article"}{" "}
            <ArrowUpRight size={14} />
          </a>
        )}
        <small>
          The original stays in your review inbox. Staff receive only the text
          you approve.
        </small>
      </section>
    ) : (
      <section className="fn-source">
        <h3>Internal FETS notice</h3>
        <p>
          This is your own announcement. It will still require your approval.
        </p>
      </section>
    );
  }
  return (
    <section className="fets-news" aria-labelledby="fets-news-title">
      <header className="fn-header">
        <div>
          <span className="fn-overline">FETS SPACE</span>
          <h1 id="fets-news-title">
            FETS News<span>.</span>
          </h1>
          <p>Client updates. Clear instructions. Industry developments.</p>
        </div>
        <div className="fn-header-actions">
          <button
            aria-label="Refresh news"
            disabled={busy}
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
          </button>
          {canReview && (
            <>
              <button
                className="fn-queue-button"
                onClick={() => {
                  setView("review");
                  setEdit(null);
                  setSelected(null);
                }}
              >
                <Inbox size={16} /> Review inbox <span>{queue.length}</span>
              </button>
              <button className="fn-primary" onClick={() => openDraft(null)}>
                <Plus size={16} /> New notice
              </button>
            </>
          )}
        </div>
      </header>
      {error && (
        <div role="alert" className="fn-error">
          {error} <button onClick={() => void load()}>Refresh</button>
        </div>
      )}
      {notice && (
        <p role="status" className="fn-success">
          <Check size={15} />
          {notice}
        </p>
      )}
      <nav className="fn-tabs" aria-label="News views">
        {[
          ["all", "Latest updates"],
          ["read", `To acknowledge${awaiting ? ` · ${awaiting}` : ""}`],
          ["industry", "Industry"],
          ["archive", "Archive"],
          ...(canReview
            ? [
                ["review", `Review inbox · ${queue.length}`],
                ["sources", "Collection"],
              ]
            : []),
        ].map(([id, label]) => (
          <button
            key={id}
            aria-current={view === id ? "page" : undefined}
            className={view === id ? "is-active" : ""}
            onClick={() => {
              setView(id);
              setSelected(null);
              setEdit(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {loading && !context ? (
        <p role="status" className="fn-empty">
          Loading news…
        </p>
      ) : edit && canReview ? (
        <>
          <button className="fn-back" onClick={() => setEdit(null)}>
            <ArrowLeft size={15} /> Back to news
          </button>
          <div className="fn-editor-layout">
            <section className="fn-editor fn-panel">
              <div className="fn-section-heading">
                <div>
                  <span className="fn-overline">PRIVATE DRAFT</span>
                  <h2>
                    {edit.draft ? kinds[edit.draft.kind] : "New FETS notice"}
                  </h2>
                </div>
                <span className="fn-status">
                  {edit.draft?.status || "Not saved"}
                </span>
              </div>
              <label>
                Title
                <input
                  maxLength={200}
                  value={edit.document.title}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      document: { ...edit.document, title: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                What changed?
                <textarea
                  rows={3}
                  maxLength={1500}
                  value={edit.document.summary}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      document: { ...edit.document, summary: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Why it matters to FETS
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={edit.document.why}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      document: { ...edit.document, why: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                What staff should do
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={edit.document.action}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      document: { ...edit.document, action: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Further details
                <textarea
                  rows={5}
                  maxLength={10000}
                  value={edit.document.body}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      document: { ...edit.document, body: e.target.value },
                    })
                  }
                />
              </label>
              <div className="fn-form-grid">
                <label>
                  Applies to
                  <select
                    value={edit.document.branch}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        document: { ...edit.document, branch: e.target.value },
                      })
                    }
                  >
                    {Object.entries(branches).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Priority
                  <select
                    value={edit.document.priority}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        document: {
                          ...edit.document,
                          priority: e.target.value as Document["priority"],
                        },
                      })
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label>
                  Client
                  <select
                    value={edit.document.client_id}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        document: {
                          ...edit.document,
                          client_id: e.target.value,
                          programme_id: "",
                        },
                      })
                    }
                  >
                    <option value="">All clients / FETS</option>
                    {catalogue.clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Programme
                  <select
                    value={edit.document.programme_id}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        document: {
                          ...edit.document,
                          programme_id: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">All programmes</option>
                    {catalogue.programmes
                      .filter((p) => p.client_id === edit.document.client_id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Effective date
                  <input
                    type="date"
                    value={edit.document.effective_on}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        document: {
                          ...edit.document,
                          effective_on: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Expires at · India time
                  <input
                    type="datetime-local"
                    value={localInput(edit.document.expires_at)}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        document: {
                          ...edit.document,
                          expires_at: istInput(e.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Link to existing work
                  <select
                    value={edit.document.related_page}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        document: {
                          ...edit.document,
                          related_page: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">No page link</option>
                    <option value="calendar">Calendar</option>
                    <option value="roster">Roster</option>
                    <option value="shift">The Shift</option>
                    <option value="case">Raise a case</option>
                    <option value="client-directory">
                      Clients & programmes
                    </option>
                  </select>
                </label>
              </div>
              <label className="fn-checkbox">
                <input
                  type="checkbox"
                  disabled={edit.draft?.kind === "industry"}
                  checked={edit.document.requires_ack}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      document: {
                        ...edit.document,
                        requires_ack: e.target.checked,
                      },
                    })
                  }
                />
                Ask staff to acknowledge this update
              </label>
              <div className="fn-editor-actions">
                <button disabled={busy} onClick={() => void save()}>
                  Save draft
                </button>
                {edit.draft && (
                  <button
                    className="fn-primary"
                    disabled={
                      busy ||
                      JSON.stringify(edit.document) !==
                        JSON.stringify(edit.draft.document)
                    }
                    onClick={() =>
                      void run(async () => {
                        await repository.publish(edit.draft!);
                        setEdit(null);
                        setView("all");
                      }, "Approved and published to the selected staff audience.")
                    }
                  >
                    <ShieldCheck size={16} /> Approve & publish
                  </button>
                )}
                {edit.draft && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      const note = window.prompt(
                        "Reason for rejecting this draft",
                      );
                      if (note?.trim())
                        void run(async () => {
                          await repository.reject(edit.draft!, note);
                          setEdit(null);
                        }, "Draft rejected. It was not published.");
                    }}
                  >
                    Reject
                  </button>
                )}
              </div>
              <small>
                Save any edits before approving. Publication records your
                account and the approved version.
              </small>
            </section>
            <aside>
              <SourcePanel source={sourceFor(edit.draft)} />
              <section className="fn-preview">
                <span className="fn-overline">STAFF PREVIEW</span>
                <h2>{edit.document.title || "Update title"}</h2>
                <p>
                  {edit.document.summary ||
                    "The short summary will appear here."}
                </p>
                {edit.document.action && (
                  <div className="fn-action">
                    <strong>What to do</strong>
                    <p>{edit.document.action}</p>
                  </div>
                )}
                <small>
                  {branches[edit.document.branch]} ·{" "}
                  {edit.document.requires_ack
                    ? "Acknowledgement requested"
                    : "For information"}
                </small>
              </section>
            </aside>
          </div>
        </>
      ) : currentPost ? (
        <>
          <button className="fn-back" onClick={() => setSelected(null)}>
            <ArrowLeft size={15} /> Back to updates
          </button>
          <article className="fn-article fn-panel">
            {metadata(currentPost)}
            <h2>{currentPost.document.title}</h2>
            {(currentPost.state !== "live" || expired(currentPost)) && (
              <p className="fn-warning">
                {currentPost.state === "superseded"
                  ? "This version has been replaced."
                  : currentPost.state === "withdrawn"
                    ? `Withdrawn: ${currentPost.withdrawal_reason}`
                    : "This update has expired."}{" "}
                It remains available for reference.
              </p>
            )}
            <p className="fn-lead">{currentPost.document.summary}</p>
            {currentPost.document.why && (
              <section>
                <h3>Why it matters</h3>
                <p>{currentPost.document.why}</p>
              </section>
            )}
            {currentPost.document.action && (
              <section className="fn-action">
                <h3>
                  {currentPost.kind === "industry"
                    ? "For awareness"
                    : "What to do"}
                </h3>
                <p>{currentPost.document.action}</p>
              </section>
            )}
            {currentPost.kind === "industry" && (
              <p className="fn-awareness">
                Industry information. It does not change a client procedure or
                FETS instruction.
              </p>
            )}
            {currentPost.document.body && (
              <section>
                <h3>Details</h3>
                <p className="fn-preserve">{currentPost.document.body}</p>
              </section>
            )}
            <div className="fn-dates">
              {currentPost.document.effective_on && (
                <span>
                  Effective{" "}
                  {date(currentPost.document.effective_on + "T00:00:00+05:30")}
                </span>
              )}
              {currentPost.document.expires_at && (
                <span>
                  Expires {stamp(currentPost.document.expires_at)} IST
                </span>
              )}
            </div>
            <footer>
              <span>
                Source: {currentPost.source_label}
                {currentPost.source_date &&
                  ` · ${date(currentPost.source_date)}`}
              </span>
              {safeLink(currentPost.source_url) && (
                <a
                  href={safeLink(currentPost.source_url)!}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read original source <ArrowUpRight size={14} />
                </a>
              )}
              {currentPost.document.related_page && (
                <a href={"/" + currentPost.document.related_page}>
                  Open{" "}
                  {
                    (
                      {
                        shift: "The Shift",
                        calendar: "Calendar",
                        roster: "Roster",
                        case: "Raise a case",
                        "client-directory": "Clients & programmes",
                      } as any
                    )[currentPost.document.related_page]
                  }{" "}
                  <ChevronRight size={14} />
                </a>
              )}
            </footer>
            {currentPost.document.requires_ack &&
              currentPost.state === "live" &&
              !expired(currentPost) && (
                <div className="fn-acknowledge">
                  {needsRead(currentPost, feed.receipts, me) ? (
                    <button
                      className="fn-primary"
                      disabled={busy || !!error}
                      onClick={() =>
                        void run(
                          () => repository.acknowledge(currentPost),
                          "Your acknowledgement is recorded.",
                        )
                      }
                    >
                      <CheckCheck size={16} /> I have read this update
                    </button>
                  ) : (
                    <p>
                      <CheckCheck size={17} />
                      You acknowledged this version
                      {feed.receipts.find(
                        (r) =>
                          r.post_id === currentPost.id && r.profile_id === me,
                      ) &&
                        ` · ${stamp(feed.receipts.find((r) => r.post_id === currentPost.id && r.profile_id === me)!.acknowledged_at)} IST`}
                    </p>
                  )}
                </div>
              )}
            {canReview && (
              <section className="fn-management">
                <h3>Publication record</h3>
                <p>
                  Approved {stamp(currentPost.published_at)} IST ·{" "}
                  {
                    feed.receipts.filter((r) => r.post_id === currentPost.id)
                      .length
                  }{" "}
                  acknowledgements
                </p>
                {feed.receipts.filter((r) => r.post_id === currentPost.id)
                  .length > 0 && (
                  <div className="fn-receipts">
                    <p className="fn-muted">
                      Acknowledgements are recorded separately for each approved
                      version.
                    </p>
                    {feed.receipts
                      .filter((r) => r.post_id === currentPost.id)
                      .map((r) => (
                        <p key={r.profile_id}>
                          {review.people.find((p: any) => p.id === r.profile_id)
                            ?.full_name || "Staff member"}{" "}
                          <span>{stamp(r.acknowledged_at)} IST</span>
                        </p>
                      ))}
                  </div>
                )}
                <div>
                  {currentPost.state === "live" && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const d = await repository.revision(currentPost);
                            openDraft(d);
                          }, "A private revision is ready. The published version stays visible until approval.")
                        }
                      >
                        Create revision
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt(
                            "Why should staff stop using this update?",
                          );
                          if (reason?.trim())
                            void run(
                              () => repository.withdraw(currentPost, reason),
                              "Update withdrawn; its publication history is retained.",
                            );
                        }}
                      >
                        Withdraw update
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}
          </article>
        </>
      ) : view === "review" && canReview ? (
        <section className="fn-review">
          <div className="fn-section-heading">
            <div>
              <h2>Ready for your review</h2>
              <p>
                These drafts are private. Nothing is published automatically.
              </p>
            </div>
            <span className="fn-status">{queue.length} awaiting review</span>
          </div>
          {queue.length === 0 ? (
            <div className="fn-empty">
              <Inbox size={28} />
              <h3>No drafts awaiting review</h3>
              <p>
                Relevant client emails and industry items will appear here after
                collection.
              </p>
            </div>
          ) : (
            queue.map((d) => (
              <button
                className="fn-review-row"
                key={d.id}
                onClick={() => openDraft(d)}
              >
                <div>
                  <span className={`fn-kind is-${d.kind}`}>
                    {kinds[d.kind]}
                  </span>
                  <h3>{d.document.title}</h3>
                  <p>{d.document.summary}</p>
                  <small>
                    {sourceFor(d)?.source_label || "FETS"} ·{" "}
                    {branches[d.document.branch]} · {stamp(d.updated_at)} IST
                  </small>
                </div>
                <span>
                  Review <ChevronRight size={16} />
                </span>
              </button>
            ))
          )}
          {review.drafts.some((d) => d.status === "rejected") && (
            <details className="fn-rejected">
              <summary>Rejected drafts</summary>
              {review.drafts
                .filter((d) => d.status === "rejected")
                .map((d) => (
                  <button key={d.id} onClick={() => openDraft(d)}>
                    {d.document.title}
                    <small>{d.review_note}</small>
                  </button>
                ))}
            </details>
          )}
        </section>
      ) : view === "sources" && canReview ? (
        <section className="fn-collection">
          <div className="fn-section-heading">
            <div>
              <h2>Collection & sources</h2>
              <p>
                Collection prepares private drafts. Every publication needs your
                approval.
              </p>
            </div>
          </div>
          {(["client", "industry"] as const).map((k) => {
            const latest = review.runs.find((r) => r.kind === k),
              enabled =
                context!.config[
                  k === "client" ? "client_enabled" : "industry_enabled"
                ];
            return (
              <article className="fn-panel" key={k}>
                <div className="fn-section-heading">
                  <div>
                    {k === "client" ? (
                      <Mail size={22} />
                    ) : (
                      <Newspaper size={22} />
                    )}
                    <h3>
                      {k === "client"
                        ? "Client email updates"
                        : "Testing-industry watch"}
                    </h3>
                    <p>
                      {k === "client"
                        ? context?.config.mailbox
                        : "Official exam, assessment and credentialing sources"}
                    </p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => repository.collection(k, !enabled),
                        enabled
                          ? "Collection paused. Existing drafts and posts are retained."
                          : "Collection enabled.",
                      )
                    }
                  >
                    {enabled ? "Pause collection" : "Enable collection"}
                  </button>
                </div>
                <p className="fn-collection-state">
                  {enabled
                    ? context!.config[
                        k === "client"
                          ? "client_scheduled"
                          : "industry_scheduled"
                      ]
                      ? "Enabled"
                      : "Not yet scheduled"
                    : "Paused"}{" "}
                  ·{" "}
                  {latest
                    ? `Last collection ${stamp(latest.completed_at)} IST · ${latest.status === "success" ? `${latest.added} new drafts` : latest.status}`
                    : "No completed collection yet"}
                </p>
                {latest?.note && <p className="fn-muted">{latest.note}</p>}
              </article>
            );
          })}
          <div className="fn-source-rules">
            <h3>What belongs here</h3>
            <p>
              Programme changes, delivery guidance, outages, useful staff
              learning and material assessment-industry developments.
            </p>
            <p>
              Promotions, sign-in codes, candidate-specific messages, case
              correspondence and repeated routine notices are excluded.
              Programme and centre scope stay separate.
            </p>
            <h3>Approved source domains</h3>
            <label className="fn-domain-editor">
              One official domain per line
              <textarea
                aria-label="Approved source domains"
                rows={5}
                value={domainDraft ?? context?.config.domains?.join("\n") ?? ""}
                onChange={(e) => setDomainDraft(e.target.value)}
              />
            </label>
            <button
              disabled={busy || domainDraft === null}
              onClick={() =>
                void run(async () => {
                  await repository.domains(
                    (domainDraft || "")
                      .split(/[\n,;]+/)
                      .map((v) => v.trim().toLowerCase())
                      .filter(Boolean),
                  );
                  setDomainDraft(null);
                }, "Approved source domains updated.")
              }
            >
              Save source domains
            </button>
            <p className="fn-muted">
              New items appear here after the next collection. Refresh news
              checks for saved drafts.
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className="fn-filters">
            <label className="fn-search">
              <Search size={16} />
              <input
                aria-label="Search news"
                placeholder="Search updates"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter by client"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            >
              <option value="">All clients</option>
              {catalogue.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by centre"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="global">All accessible centres</option>
              {Object.entries(branches)
                .filter(([k]) => k !== "global")
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </div>
          {posts.length === 0 ? (
            <div className="fn-empty">
              <Newspaper size={30} />
              <h2>
                {view === "read"
                  ? "No acknowledgements in this view"
                  : view === "archive"
                    ? "No archived updates"
                    : "No matching published updates"}
              </h2>
              <p>
                {view === "read"
                  ? "There are no outstanding acknowledgements in the loaded updates."
                  : "Only approved news appears here."}
              </p>
              {canReview && view === "all" && queue.length > 0 && (
                <button onClick={() => setView("review")}>
                  Review {queue.length} private drafts{" "}
                  <ChevronRight size={15} />
                </button>
              )}
            </div>
          ) : (
            <div className="fn-feed">
              {posts.map((p) => (
                <article
                  key={p.id}
                  className={`fn-news-card ${p.document.priority !== "normal" ? "is-important" : ""}`}
                >
                  {metadata(p)}
                  <div className="fn-card-title">
                    <h2>
                      <button onClick={() => setSelected(p)}>
                        {p.document.title}
                      </button>
                    </h2>
                    {p.document.priority !== "normal" && (
                      <span className={`fn-priority is-${p.document.priority}`}>
                        {p.document.priority === "urgent"
                          ? "Urgent"
                          : "Important"}
                      </span>
                    )}
                  </div>
                  <p>{p.document.summary}</p>
                  {p.document.action && (
                    <div className="fn-card-action">
                      <span>
                        {p.kind === "industry" ? "For awareness" : "What to do"}
                      </span>
                      <p>{p.document.action}</p>
                    </div>
                  )}
                  <footer>
                    <span>
                      {p.state !== "live"
                        ? p.state
                        : expired(p)
                          ? "Expired"
                          : needsRead(p, feed.receipts, me)
                            ? "Acknowledgement requested"
                            : p.kind === "industry"
                              ? "For information"
                              : p.document.requires_ack
                                ? "Acknowledged"
                                : "For information"}
                    </span>
                    <button onClick={() => setSelected(p)}>
                      Read update <ArrowUpRight size={15} />
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
          {hasMore && (
            <p className="fn-muted">
              Showing {feed.posts.length} loaded updates. Load older updates to
              search further back.
            </p>
          )}
          {hasMore && (
            <button
              disabled={busy}
              className="fn-load-more"
              onClick={() =>
                void run(
                  async () => {
                    const f = await repository.feed(page + 1);
                    setFeed((v) => ({ ...v, posts: [...v.posts, ...f.posts] }));
                    setPage(page + 1);
                    setHasMore(f.posts.length === 100);
                  },
                  "",
                  false,
                )
              }
            >
              Load older updates
            </button>
          )}
          {feed.legacy.length > 0 && view === "all" && !search && !client && (
            <details className="fn-legacy">
              <summary>Previous notices</summary>
              {feed.legacy
                .filter(
                  (n: any) =>
                    ["all", "global"].includes(branch) ||
                    n.branch_location === "global" ||
                    n.branch_location === branch,
                )
                .map((n: any) => (
                  <article key={n.id}>
                    <p>{n.content}</p>
                    <small>
                      {branches[n.branch_location] || n.branch_location} ·{" "}
                      {n.created_at ? date(n.created_at) : "Previous notice"}
                    </small>
                  </article>
                ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}
