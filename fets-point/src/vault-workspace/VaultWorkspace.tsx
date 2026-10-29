import { useEffect, useRef, useState } from "react";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Search,
  X,
  Save,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { mergeVault, safeLink, customFields, type VaultItem } from "./model";
import "./vault.css";
const fields = [
  ["username", "Username"],
  ["password", "Password"],
  ["url", "Portal URL"],
  ["site_id", "Site ID"],
  ["prof_email", "Professional email"],
  ["prof_email_password", "Email password"],
  ["other_urls", "Additional links"],
  ["contact_numbers", "Contact numbers"],
  ["notes", "Notes"],
] as const;
export default function VaultWorkspace() {
  const { user } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [active, setActive] = useState<VaultItem | null>(null),
    [editing, setEditing] = useState(false),
    [revealed, setRevealed] = useState<Record<string, boolean>>({}),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const generation = useRef(0),
    secretTimer = useRef<ReturnType<typeof setTimeout>>(),
    dialog = useRef<HTMLDialogElement>(null);
  const reveal = (key: string) => {
    setRevealed((previous) => ({ ...previous, [key]: !previous[key] }));
    clearTimeout(secretTimer.current);
    secretTimer.current = setTimeout(() => setRevealed({}), 30000);
  };
  useEffect(() => {
    if (active && !dialog.current?.open) dialog.current?.showModal();
    return () => clearTimeout(secretTimer.current);
  }, [active?.id]);
  const load = async () => {
    if (!user?.id) return;
    const id = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const rows: VaultItem[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("fets_vault")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < 1000) break;
      }
      if (id === generation.current) setItems(mergeVault(rows));
    } catch {
      if (id === generation.current)
        setError(
          "F Vault could not be loaded. Your saved entries have not been changed.",
        );
    } finally {
      if (id === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    setItems([]);
    setActive(null);
    setRevealed({});
    void load();
    return () => {
      generation.current++;
    };
  }, [user?.id]);
  useEffect(() => {
    setRevealed({});
    setMessage("");
    if (!active) return;
    const hide = () => setRevealed({});
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("blur", hide);
      clearTimeout(secretTimer.current);
    };
  }, [active?.id]);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied.");
    } catch {
      setMessage("Copy is unavailable. You can select the value instead.");
    }
  };
  const save = async () => {
    if (!active?.title.trim() || !user?.id) return;
    setBusy(true);
    setError("");
    try {
      const payload = Object.fromEntries(
        [
          "title",
          "category",
          ...fields.map((f) => f[0]),
          "tags",
          "custom_fields",
        ].map((key) => [
          key,
          active[key as keyof VaultItem] ??
            (key === "tags" || key === "custom_fields" ? [] : ""),
        ]),
      );
      const result =
        active.id === "new"
          ? await supabase
              .from("fets_vault")
              .insert({ ...payload, user_id: user.id })
              .select()
              .single()
          : await supabase
              .from("fets_vault")
              .update(payload)
              .eq("id", active.id)
              .eq("user_id", user.id)
              .select()
              .single();
      if (result.error) throw result.error;
      setActive(null);
      setEditing(false);
      await load();
    } catch {
      setError("The entry was not saved. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const selected = items.filter(
    (x) =>
      (category === "All" || (x.category || "General") === category) &&
      `${x.title} ${x.category || ""} ${x.username || ""} ${x.site_id || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="fv-workspace">
      <header>
        <div>
          <span className="fv-eyebrow">YOUR SAVED ACCESS</span>
          <h1>F Vault</h1>
          <p>Portals, logins and useful links. One place.</p>
        </div>
        <button
          className="fv-primary"
          disabled={!user?.id}
          onClick={() => {
            if (!user?.id) return;
            setActive({
              id: "new",
              user_id: user!.id,
              title: "",
              category: "General",
            });
            setEditing(true);
          }}
        >
          <Plus size={16} />
          Add entry
        </button>
      </header>
      <div className="fv-search">
        <Search size={17} />
        <input
          type="search"
          aria-label="Search F Vault"
          placeholder="Find a portal, client or site…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="fv-categories">
        {["All", ...new Set(items.map((i) => i.category || "General"))].map(
          (c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ),
        )}
      </div>
      {error && !active && (
        <p role="alert">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {loading ? (
        <p role="status">Opening F Vault…</p>
      ) : (
        <div className="fv-grid">
          {selected.map((item) => (
            <button
              className="fv-card"
              key={item.id}
              onClick={() => {
                setActive(item);
                setEditing(false);
              }}
            >
              <KeyRound size={21} />
              <ExternalLink size={15} />
              <small>{item.category || "General"}</small>
              <strong>{item.title}</strong>
              <span>
                {safeLink(item.url)
                  ? new URL(safeLink(item.url)!).hostname
                  : item.site_id || "Saved entry"}
              </span>
            </button>
          ))}
          {!selected.length && <p>No saved entries match this view.</p>}
        </div>
      )}
      {active && (
        <dialog
          ref={dialog}
          className="fv-detail"
          aria-label={editing ? "Edit vault entry" : active.title}
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setActive(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              const r = e.currentTarget.getBoundingClientRect();
              if (
                e.clientX < r.left ||
                e.clientX > r.right ||
                e.clientY < r.top ||
                e.clientY > r.bottom
              )
                setActive(null);
            }
          }}
        >
          <header>
            <div>
              <span className="fv-eyebrow">F VAULT</span>
              <h2>{editing ? "Save an entry" : active.title}</h2>
            </div>
            <button
              aria-label="Close vault entry"
              onClick={() => setActive(null)}
              disabled={busy}
            >
              <X size={20} />
            </button>
          </header>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label>
                Title
                <input
                  required
                  value={active.title}
                  maxLength={200}
                  onChange={(e) =>
                    setActive({ ...active, title: e.target.value })
                  }
                />
              </label>
              <label>
                Category
                <input
                  value={active.category || ""}
                  maxLength={80}
                  onChange={(e) =>
                    setActive({ ...active, category: e.target.value })
                  }
                />
              </label>
              {fields.map(([key, label]) => (
                <label key={key}>
                  {label}
                  {["notes", "other_urls", "contact_numbers"].includes(key) ? (
                    <textarea
                      value={active[key] || ""}
                      onChange={(e) =>
                        setActive({ ...active, [key]: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      type={key.includes("password") ? "password" : "text"}
                      value={active[key] || ""}
                      onChange={(e) =>
                        setActive({ ...active, [key]: e.target.value })
                      }
                    />
                  )}
                </label>
              ))}
              <button className="fv-primary" disabled={busy}>
                <Save size={16} />
                {busy ? "Saving…" : "Save entry"}
              </button>
            </form>
          ) : (
            <>
              <div className="fv-detail-fields">
                {fields
                  .filter(([key]) => active[key])
                  .map(([key, label]) => (
                    <div key={key}>
                      <small>{label}</small>
                      <div>
                        <span>
                          {key.includes("password") && !revealed[key]
                            ? "••••••••••••"
                            : active[key]}
                        </span>
                        {key.includes("password") && (
                          <button
                            aria-label={`${revealed[key] ? "Hide" : "Show"} ${label}`}
                            onClick={() => reveal(key)}
                          >
                            {revealed[key] ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        )}
                        <button
                          aria-label={`Copy ${label}`}
                          onClick={() => void copy(active[key]!)}
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                      {key === "url" && safeLink(active.url) && (
                        <a
                          href={safeLink(active.url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open portal
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  ))}
                {customFields(active.custom_fields).map((field, i) => (
                  <div key={i}>
                    <small>{field.key}</small>
                    <div>
                      <span>
                        {revealed["custom" + i] ? field.value : "••••••••••••"}
                      </span>
                      <button
                        aria-label={`${revealed["custom" + i] ? "Hide" : "Show"} ${field.key}`}
                        onClick={() => reveal("custom" + i)}
                      >
                        {revealed["custom" + i] ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                      <button
                        aria-label={`Copy ${field.key}`}
                        onClick={() => void copy(field.value)}
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                {active.description && (
                  <div>
                    <small>Description</small>
                    <p>{active.description}</p>
                  </div>
                )}
                {active.content && (
                  <div>
                    <small>Saved content</small>
                    <p>{active.content}</p>
                  </div>
                )}
                {safeLink(active.file_url) && (
                  <a
                    href={safeLink(active.file_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open saved file
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
              <button className="fv-primary" onClick={() => setEditing(true)}>
                Edit entry
              </button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <p role="status">{message}</p>
        </dialog>
      )}
    </div>
  );
}
