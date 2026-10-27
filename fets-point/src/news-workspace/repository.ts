import { supabase } from "../lib/supabase";
import {
  type Context,
  type Draft,
  type Post,
  type Receipt,
  type Source,
  type Run,
  type Document,
} from "./model";
const db = supabase as any;
const get = (r: any) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
export const repository = {
  async context() {
    const [c, a, b] = await Promise.all([
      db.rpc("fets_news_context"),
      db.from("clients").select("id,name").order("name"),
      db.from("client_exams").select("id,client_id,name").order("name"),
    ]);
    return {
      config: get(c) as Context,
      clients: get(a) || [],
      programmes: get(b) || [],
    };
  },
  async feed(page = 0) {
    const [p, r, old] = await Promise.all([
      db
        .from("fets_news_posts")
        .select("*")
        .order("published_at", { ascending: false })
        .range(page * 100, page * 100 + 99),
      db.from("fets_news_receipts").select("*"),
      page === 0
        ? db
            .from("news_ticker")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    return {
      posts: (get(p) as Post[]) || [],
      receipts: (get(r) as Receipt[]) || [],
      legacy: get(old) || [],
    };
  },
  async review() {
    const [d, s, r, people] = await Promise.all([
      db
        .from("fets_news_drafts")
        .select("*")
        .in("status", ["draft", "review", "rejected"])
        .order("updated_at", { ascending: false })
        .limit(300),
      db
        .from("fets_news_sources")
        .select("*")
        .order("collected_at", { ascending: false })
        .limit(500),
      db
        .from("fets_news_collection_runs")
        .select("*")
        .order("completed_at", { ascending: false })
        .limit(30),
      db.from("staff_profiles").select("id,full_name").order("full_name"),
    ]);
    return {
      people: get(people) || [],
      drafts: (get(d) as Draft[]) || [],
      sources: (get(s) as Source[]) || [],
      runs: (get(r) as Run[]) || [],
    };
  },
  async save(document: Document, prior: Draft | null) {
    let q;
    if (prior) {
      q = db
        .from("fets_news_drafts")
        .update({ document, status: "review", review_note: "" })
        .eq("id", prior.id)
        .eq("version", prior.version);
    } else
      q = db.from("fets_news_drafts").insert({
        document,
        kind: "internal",
        source_id: null,
        revision_of: null,
        status: "review",
      });
    const rows = get(await q.select());
    if (!rows?.[0])
      throw Error(
        "This draft changed on another screen. Refresh before saving.",
      );
    return rows[0] as Draft;
  },
  async revision(post: Post) {
    const pending = get(
      await db
        .from("fets_news_drafts")
        .select("*")
        .eq("revision_of", post.id)
        .in("status", ["draft", "review"])
        .maybeSingle(),
    );
    if (pending) return pending as Draft;
    const old = get(
      await db
        .from("fets_news_drafts")
        .select("*")
        .eq("id", post.draft_id)
        .single(),
    );
    return get(
      await db
        .from("fets_news_drafts")
        .insert({
          kind: post.kind,
          document: post.document,
          source_id: old.source_id,
          revision_of: post.id,
          status: "review",
        })
        .select()
        .single(),
    ) as Draft;
  },
  async publish(draft: Draft) {
    return get(
      await db.rpc("fets_news_publish", {
        p_draft: draft.id,
        p_version: draft.version,
      }),
    );
  },
  async reject(draft: Draft, note: string) {
    const rows = get(
      await db
        .from("fets_news_drafts")
        .update({ status: "rejected", review_note: note })
        .eq("id", draft.id)
        .eq("version", draft.version)
        .select(),
    );
    if (!rows?.[0])
      throw Error("This draft changed. Refresh before rejecting it.");
  },
  async acknowledge(post: Post) {
    const result = await db
      .from("fets_news_receipts")
      .insert({ post_id: post.id })
      .select()
      .single();
    if (result.error?.code === "23505") return;
    get(result);
  },
  async withdraw(post: Post, reason: string) {
    const rows = get(
      await db
        .from("fets_news_posts")
        .update({ state: "withdrawn", withdrawal_reason: reason })
        .eq("id", post.id)
        .eq("state", "live")
        .select(),
    );
    if (!rows?.[0])
      throw Error("This update changed. Refresh before withdrawing it.");
  },
  async domains(domains: string[]) {
    return get(
      await db.rpc("fets_news_set_domains", { p_domains: domains }),
    ) as Context;
  },
  async collection(kind: string, enabled: boolean) {
    return get(
      await db.rpc("fets_news_set_collection", {
        p_kind: kind,
        p_enabled: enabled,
      }),
    ) as Context;
  },
};
export type Repository = typeof repository;
