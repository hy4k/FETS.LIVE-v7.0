import { useEffect, useState } from "react";
import { Brain, FileText } from "lucide-react";
import { type KnowledgeRow, type MemoryRow } from "../../fets-ai/fets-ai-api";
import { useAgentResource } from "../../fets-ai/useAgentResource";
const inputCls =
  "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400";
export function DataVaultPanel({
  userId,
  branch,
  isAdmin = false,
}: {
  userId: string;
  branch: string;
  isAdmin?: boolean;
}) {
  const [tab, setTab] = useState<"knowledge" | "memory">("knowledge");
  const memories = useAgentResource<{
      memories: MemoryRow[];
    }>(userId, branch, "memories"),
    knowledge = useAgentResource<{
      documents: KnowledgeRow[];
    }>(userId, branch, "knowledge");
  const [editMemory, setEditMemory] = useState<MemoryRow | null>(null),
    [key, setKey] = useState(""),
    [value, setValue] = useState(""),
    [scope, setScope] = useState<MemoryRow["scope"]>("user"),
    [active, setActive] = useState(true);
  const [sourceUrl, setSourceUrl] = useState("");
  const [editDoc, setEditDoc] = useState<KnowledgeRow | null>(null),
    [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [category, setCategory] = useState("general"),
    [docBranch, setDocBranch] = useState(branch === "global" ? "*" : branch);
  const resetMemory = () => {
    setEditMemory(null);
    setKey("");
    setValue("");
    setScope("user");
    setActive(true);
  };
  const resetDoc = () => {
    setSourceUrl("");
    setEditDoc(null);
    setTitle("");
    setContent("");
    setCategory("general");
    setDocBranch(branch === "global" ? "*" : branch);
  };
  useEffect(() => {
    resetMemory();
    resetDoc();
  }, [userId, branch]);
  const editable = (m: MemoryRow) =>
    isAdmin ||
    (m.scope === "user" &&
      (m.scope_ref === userId ||
        (!m.scope_ref && !m.created_by) ||
        m.created_by === userId));
  const resource = tab === "memory" ? memories : knowledge;
  const saveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      await memories.mutate({
        action: "memory-save",
        id: editMemory?.id,
        key: key.trim(),
        value: value.trim(),
        scope,
        active,
        importance: editMemory?.importance ?? 3,
      })
    )
      resetMemory();
  };
  const saveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      await knowledge.mutate({
        action: "knowledge-save",
        document: {
          id: editDoc?.id,
          source: editDoc?.source,
          title: title.trim(),
          category: category.trim(),
          content: content.trim(),
          branch: docBranch,
          version: editDoc?.version,
          source_url: sourceUrl.trim() || null,
        },
      })
    )
      resetDoc();
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["knowledge", "memory"] as const).map((t) => (
          <button
            key={t}
            className={`flex gap-2 items-center px-4 py-2 rounded-xl border text-sm ${
              tab === t ? "bg-indigo-50 text-indigo-700" : "text-slate-500"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "knowledge" ? <FileText size={14} /> : <Brain size={14} />}
            {t === "knowledge" ? "External Knowledge" : "Pinned Memory"}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Pinned active instructions apply to every text and live session.
        Reference documents are searched when relevant. Personal instructions
        survive a new chat.
      </p>
      {resource.error && (
        <div role="alert" className="text-rose-700">
          {resource.error}
          <button onClick={resource.load} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}
      {tab === "memory" && (
        <>
          <form
            onSubmit={saveMemory}
            className="bg-slate-50 border rounded-2xl p-4 space-y-3"
          >
            <label className="text-xs block">
              Memory key
              <input
                aria-label="Memory key"
                required
                maxLength={200}
                className={inputCls}
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <label className="text-xs block">
              Memory value
              <textarea
                aria-label="Memory value"
                required
                rows={3}
                className={inputCls}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <div className="flex gap-3">
              <label className="text-xs">
                Scope
                <select
                  aria-label="Memory scope"
                  className={inputCls}
                  value={scope}
                  disabled={Boolean(editMemory)}
                  onChange={(e) =>
                    setScope(e.target.value as MemoryRow["scope"])
                  }
                >
                  <option value="user">Personal</option>
                  {isAdmin && branch !== "global" && (
                    <option value="branch">Centre · {branch}</option>
                  )}
                  {isAdmin && <option value="global">Company</option>}
                </select>
              </label>
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />{" "}
                Active
              </label>
            </div>
            <button
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm disabled:opacity-40"
              disabled={
                memories.loading ||
                memories.saving ||
                !key.trim() ||
                !value.trim()
              }
            >
              Save memory
            </button>
            {editMemory && (
              <button type="button" className="ml-3" onClick={resetMemory}>
                Cancel edit
              </button>
            )}
          </form>
          {!memories.loading && !(memories.data?.memories || []).length && (
            <p className="text-sm text-slate-500">
              No pinned memories in this scope.
            </p>
          )}
          {memories.data?.memories.map((m) => (
            <article
              key={m.id}
              className="border rounded-2xl bg-white p-4 space-y-2"
            >
              <strong>{m.mem_key}</strong>
              <span className="text-xs ml-2 text-slate-500">
                {m.scope === "user"
                  ? "Personal"
                  : m.scope === "branch"
                  ? "Centre"
                  : "Company"}{" "}
                · {m.is_active ? "Active" : "Inactive"}
              </span>
              <p className="text-sm whitespace-pre-wrap">{m.mem_value}</p>
              <small className="block text-slate-500">
                Saved memory ID: {m.id}
              </small>
              {editable(m) && (
                <div className="flex gap-4 text-xs text-indigo-700">
                  <button
                    aria-label={`Edit ${m.mem_key}`}
                    disabled={memories.saving}
                    onClick={() => {
                      setEditMemory(m);
                      setKey(m.mem_key);
                      setValue(m.mem_value);
                      setScope(m.scope);
                      setActive(m.is_active);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    aria-label={`${m.is_active ? "Disable" : "Enable"} ${
                      m.mem_key
                    }`}
                    disabled={memories.saving}
                    onClick={() =>
                      memories.mutate(
                        m.is_active
                          ? { action: "memory-delete", id: m.id }
                          : {
                              action: "memory-save",
                              id: m.id,
                              key: m.mem_key,
                              value: m.mem_value,
                              scope: m.scope,
                              active: true,
                              importance: m.importance,
                            }
                      )
                    }
                  >
                    {m.is_active ? "Disable" : "Enable"}
                  </button>
                </div>
              )}
            </article>
          ))}
        </>
      )}
      {tab === "knowledge" && (
        <>
          {isAdmin && (
            <form
              onSubmit={saveDoc}
              className="bg-slate-50 border rounded-2xl p-4 space-y-3"
            >
              <label className="text-xs block">
                Document title
                <input
                  required
                  aria-label="Document title"
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="text-xs block">
                Category
                <input
                  aria-label="Document category"
                  className={inputCls}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>
              <label className="text-xs block">
                Reference content
                <textarea
                  required
                  aria-label="Reference content"
                  rows={4}
                  className={inputCls}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </label>
              <label className="text-xs block">
                Source link · optional
                <input
                  aria-label="Source link · optional"
                  type="url"
                  pattern="https://.*"
                  className={inputCls}
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://…"
                />
              </label>
              <label className="text-xs block">
                Document scope
                <select
                  aria-label="Document scope"
                  className={inputCls}
                  value={docBranch}
                  onChange={(e) => setDocBranch(e.target.value)}
                >
                  <option value="*">Company</option>
                  {branch !== "global" && (
                    <option value={branch}>Centre · {branch}</option>
                  )}
                </select>
              </label>
              <button
                className="bg-indigo-600 text-white text-sm rounded-xl px-4 py-2 disabled:opacity-40"
                disabled={
                  knowledge.loading ||
                  knowledge.saving ||
                  !title.trim() ||
                  !content.trim()
                }
              >
                Save knowledge
              </button>
              {editDoc && (
                <button type="button" onClick={resetDoc} className="ml-3">
                  Cancel edit
                </button>
              )}
            </form>
          )}
          {!knowledge.loading && !(knowledge.data?.documents || []).length && (
            <p className="text-sm text-slate-500">
              No reference documents available.
            </p>
          )}
          {knowledge.data?.documents.map((d) => (
            <article
              key={`${d.source}-${d.id}`}
              className="border bg-white rounded-2xl p-4 space-y-2"
            >
              <strong>{d.title}</strong>
              <span className="ml-2 text-xs text-slate-500">
                {d.source} · {d.branch === "*" ? "Company" : d.branch} ·{" "}
                {d.status} · v{d.version}
              </span>
              <p className="text-sm whitespace-pre-wrap">{d.content}</p>
              {d.source_url?.startsWith("https://") && (
                <a
                  className="text-xs text-indigo-700"
                  href={d.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source reference
                </a>
              )}
              {isAdmin && (
                <div className="flex gap-4 text-xs text-indigo-700">
                  <button
                    disabled={knowledge.saving}
                    aria-label={`Edit ${d.title}`}
                    onClick={() => {
                      setSourceUrl(d.source_url || "");
                      setEditDoc(d);
                      setTitle(d.title);
                      setContent(d.content);
                      setCategory(d.category || "general");
                      setDocBranch(d.branch);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    disabled={knowledge.saving || d.status === "archived"}
                    onClick={() =>
                      knowledge.mutate({
                        action: "knowledge-archive",
                        id: d.id,
                        source: d.source,
                        version: d.version,
                      })
                    }
                  >
                    Archive
                  </button>
                </div>
              )}
            </article>
          ))}
        </>
      )}
      {resource.loading && <p className="text-sm text-slate-500">Loading…</p>}
    </div>
  );
}
