export type NewsKind = "client" | "industry" | "internal";
export type Document = {
  title: string;
  summary: string;
  body: string;
  action: string;
  why: string;
  branch: string;
  client_id: string;
  programme_id: string;
  priority: "normal" | "important" | "urgent";
  requires_ack: boolean;
  effective_on: string;
  expires_at: string;
  related_page: string;
};
export type Source = {
  id: string;
  kind: NewsKind;
  external_key: string;
  source_label: string;
  domain: string;
  sender: string;
  source_date: string;
  public_url: string | null;
  private_reference: string;
  excerpt: string;
  verification: string;
  collected_at: string;
};
export type Draft = {
  id: string;
  source_id: string | null;
  kind: NewsKind;
  document: Document;
  status: "draft" | "review" | "published" | "rejected";
  revision_of: string | null;
  version: number;
  review_note: string;
  created_at: string;
  updated_at: string;
};
export type Post = {
  id: string;
  draft_id: string;
  kind: NewsKind;
  document: Document;
  source_label: string;
  source_date: string | null;
  source_url: string | null;
  approved_by: string;
  published_at: string;
  supersedes_id: string | null;
  state: "live" | "superseded" | "withdrawn";
  withdrawal_reason: string;
  withdrawn_at: string | null;
};
export type Receipt = {
  post_id: string;
  profile_id: string;
  acknowledged_at: string;
};
export type Context = {
  can_review: boolean;
  client_scheduled?: boolean;
  industry_scheduled?: boolean;
  mailbox?: string;
  client_enabled?: boolean;
  industry_enabled?: boolean;
  domains?: string[];
  approval_required?: boolean;
};
export type Run = {
  id: number;
  kind: "client" | "industry";
  status: "success" | "failed" | "paused";
  added: number;
  note: string;
  completed_at: string;
};
export type Catalogue = {
  clients: { id: string; name: string }[];
  programmes: { id: string; client_id: string; name: string }[];
};
export const kinds: Record<NewsKind, string> = {
  client: "Client update",
  industry: "Industry news",
  internal: "FETS notice",
};
export const branches: Record<string, string> = {
  global: "All centres",
  calicut: "Calicut",
  cochin: "Cochin",
  mobile: "Mobile unit",
};
export const emptyDocument = (): Document => ({
  title: "",
  summary: "",
  body: "",
  action: "",
  why: "",
  branch: "global",
  client_id: "",
  programme_id: "",
  priority: "normal",
  requires_ack: false,
  effective_on: "",
  expires_at: "",
  related_page: "",
});
export function expired(p: Post, now = Date.now()) {
  return !!p.document.expires_at && Date.parse(p.document.expires_at) <= now;
}
export function needsRead(
  p: Post,
  receipts: Receipt[],
  profile: string,
  now = Date.now(),
) {
  return (
    p.state === "live" &&
    !expired(p, now) &&
    p.document.requires_ack &&
    !receipts.some((r) => r.post_id === p.id && r.profile_id === profile)
  );
}
export function visiblePosts(
  posts: Post[],
  receipts: Receipt[],
  me: string,
  {
    branch = "global",
    client = "",
    search = "",
    view = "all",
    now = Date.now(),
  } = {},
) {
  const q = search.trim().toLowerCase();
  return posts
    .filter(
      (p) =>
        (["all", "global"].includes(branch) ||
          p.document.branch === "global" ||
          p.document.branch === branch) &&
        (!client || p.document.client_id === client) &&
        (!q ||
          [
            p.document.title,
            p.document.summary,
            p.document.body,
            p.document.action,
            p.source_label,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (view === "archive"
          ? p.state !== "live" || expired(p, now)
          : p.state === "live" && !expired(p, now)) &&
        (view !== "read" || needsRead(p, receipts, me, now)) &&
        (view !== "industry" || p.kind === "industry"),
    )
    .sort((a, b) => {
      const rank = { urgent: 0, important: 1, normal: 2 };
      return (
        rank[a.document.priority] - rank[b.document.priority] ||
        Date.parse(b.published_at) - Date.parse(a.published_at)
      );
    });
}
export function validate(d: Document, kind: NewsKind) {
  const problems: string[] = [];
  if (!d.title.trim() || d.title.length > 200)
    problems.push("Enter a title of up to 200 characters.");
  if (!d.summary.trim() || d.summary.length > 1500)
    problems.push("Enter a short summary.");
  if (d.expires_at && Date.parse(d.expires_at) <= Date.now())
    problems.push("Choose an expiry in the future.");
  if (kind === "industry" && d.requires_ack)
    problems.push(
      "Industry news is for awareness, not a required instruction.",
    );
  return problems;
}
export function safeLink(url: string | null | undefined) {
  try {
    const u = new URL(url || "");
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function localInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(" ", "T");
}
export function istInput(v: string) {
  return v ? new Date(v + ":00+05:30").toISOString() : "";
}
