// @ts-nocheck
/* eslint-disable */
/*
  "The Lab" — coordination wall. Built on the existing social_posts /
  social_post_likes / social_post_comments tables + chat-uploads storage.

  Structured fields use real columns where they exist (post_type,
  branch_location); the rest (exam tag, compliance flag, pin, acknowledgements,
  extra attachments) ride in a compact metadata marker appended to content, so
  no schema migration is required. All writes are defensive.
*/
import { supabase } from "../lib/supabase";

const F = () => window.FETS;
const MARK = "<!--LAB:";
function parse(raw) {
  let text = raw || "", meta = {};
  const i = (raw || "").indexOf(MARK);
  if (i >= 0) { text = raw.slice(0, i).trim(); const j = raw.lastIndexOf("-->"); try { meta = JSON.parse(raw.slice(i + MARK.length, j)); } catch (e) {} }
  return { text, meta };
}
function pack(text, meta) { return `${text || ""}\n\n${MARK}${JSON.stringify(meta || {})}-->`; }

function rowToPost(r) {
  const { text, meta } = parse(r.content);
  const likes = r.likes || [];
  const me = F()._meUserId;
  return {
    id: r.id,
    text,
    type: r.post_type || meta.type || "general",
    center: r.branch_location || meta.center || "all",
    image: r.image_url || null,
    attachments: meta.attachments || [],
    exam: meta.exam || null,
    compliance: !!meta.compliance,
    pinned: !!meta.pinned,
    acks: meta.acks || [],
    mine: !!me && (r.user_id === me || r.author_id === F()._meId),
    authorName: (r.author && r.author.full_name) || meta.authorName || "Staff",
    role: (r.author && r.author.role) || "",
    when: r.created_at ? new Date(r.created_at) : new Date(),
    likeCount: likes.length,
    likedByMe: likes.some((l) => l.user_id === me),
    _likes: likes.map((l) => l.user_id),
    reactions: { "👏": likes.map((l) => l.user_id) },
    comments: (r.comments || []).map((c) => ({ id: c.id, text: c.content, name: (c.author && c.author.full_name) || "Staff", at: c.created_at })).sort((a, b) => new Date(a.at) - new Date(b.at)),
    _meta: meta,
  };
}

const SELECT = `*,
  author:staff_profiles!social_posts_author_id_fkey(id, full_name, avatar_url, role),
  likes:social_post_likes(user_id),
  comments:social_post_comments(id, author_id, content, created_at, author:staff_profiles!social_post_comments_author_id_fkey(full_name, avatar_url))`;

export const LAB_EMOJIS = ["👏", "❤️", "🔥", "✅", "🎉", "👀"];

export async function labFetch() {
  let posts = [];
  try {
    const { data, error } = await supabase.from("social_posts").select(SELECT)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("created_at", { ascending: false }).limit(300);
    if (error) throw error;
    posts = (data || []).map(rowToPost);
  } catch (e) {
    try {
      const { data } = await supabase.from("social_posts").select("*")
        .or("is_archived.is.null,is_archived.eq.false")
        .order("created_at", { ascending: false }).limit(300);
      posts = (data || []).map(rowToPost);
    } catch (e2) { posts = []; }
  }
  // phase-2 overlays — multi-emoji reactions + comments (graceful if tables absent)
  try {
    const { data, error } = await supabase.from("lab_reactions").select("*");
    if (!error && data) {
      F()._labReactions = true;
      const byPost = {};
      data.forEach((r) => { (byPost[r.post_id] = byPost[r.post_id] || {}); (byPost[r.post_id][r.emoji] = byPost[r.post_id][r.emoji] || []).push(r.user_id); });
      posts.forEach((p) => { p.reactions = byPost[String(p.id)] || {}; });
    }
  } catch (e) {}
  try {
    const { data, error } = await supabase.from("lab_comments").select("*").order("created_at", { ascending: true });
    if (!error && data) {
      F()._labComments = true;
      const byPost = {};
      data.forEach((c) => { (byPost[c.post_id] = byPost[c.post_id] || []).push({ id: c.id, text: c.content, name: c.author_name || "Staff", at: c.created_at, uid: c.user_id }); });
      posts.forEach((p) => { if (byPost[String(p.id)]) p.comments = byPost[String(p.id)]; });
    }
  } catch (e) {}
  return posts;
}

export async function labReact(postId, emoji, mine) {
  const uid = F()._meUserId; if (!uid) return;
  if (F()._labReactions) {
    try {
      if (mine) await supabase.from("lab_reactions").delete().eq("post_id", String(postId)).eq("user_id", uid).eq("emoji", emoji);
      else await supabase.from("lab_reactions").insert([{ post_id: String(postId), user_id: uid, emoji }]);
    } catch (e) {}
  } else {
    try {
      if (mine) await supabase.from("social_post_likes").delete().eq("post_id", postId).eq("user_id", uid);
      else await supabase.from("social_post_likes").insert([{ post_id: postId, user_id: uid }]);
    } catch (e) {}
  }
}

export async function labMarkRead() {
  const uid = F()._meUserId; if (!uid) return;
  try { await supabase.from("lab_reads").upsert([{ user_id: uid, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }], { onConflict: "user_id" }); } catch (e) {}
}

export async function labUnread() {
  const uid = F()._meUserId; if (!uid) return 0;
  try {
    const { data: rd } = await supabase.from("lab_reads").select("last_seen_at").eq("user_id", uid).maybeSingle();
    const since = (rd && rd.last_seen_at) || new Date(Date.now() - 7 * 864e5).toISOString();
    const { count } = await supabase.from("social_posts").select("id", { count: "exact", head: true })
      .gt("created_at", since).or("is_archived.is.null,is_archived.eq.false");
    return count || 0;
  } catch (e) { return 0; }
}

export async function labCreate(p) {
  const meta = { type: p.type, center: p.center, exam: p.exam || null, compliance: !!p.compliance, pinned: false, acks: [], attachments: p.attachments || [], authorName: F().user.name };
  const content = pack(p.text, meta);
  const full = { content, post_type: p.type, branch_location: p.center === "all" ? null : p.center, image_url: p.image || null, user_id: F()._meUserId || null };
  try {
    const { data, error } = await supabase.from("social_posts").insert([full]).select(SELECT).single();
    if (error) throw error;
    return rowToPost(data);
  } catch (e) {
    try {
      const { data, error } = await supabase.from("social_posts").insert([{ content, image_url: p.image || null, user_id: F()._meUserId || null }]).select("*").single();
      if (error) throw error;
      return rowToPost(data);
    } catch (e2) { return null; }
  }
}

/* rebuild the metadata marker and persist (pin / exam / compliance / acks / edit) */
export async function labSaveMeta(post) {
  const meta = { type: post.type, center: post.center, exam: post.exam, compliance: post.compliance, pinned: post.pinned, acks: post.acks, attachments: post.attachments, authorName: post.authorName };
  const content = pack(post.text, meta);
  try { const { error } = await supabase.from("social_posts").update({ content, post_type: post.type, branch_location: post.center === "all" ? null : post.center }).eq("id", post.id); if (error) throw error; return true; }
  catch (e) { try { await supabase.from("social_posts").update({ content }).eq("id", post.id); return true; } catch (e2) { return false; } }
}

export async function labDelete(id) {
  try { await supabase.from("social_posts").update({ is_archived: true }).eq("id", id); return true; } catch (e) { return false; }
}

export async function labToggleLike(postId, liked) {
  const uid = F()._meUserId; if (!uid) return;
  try {
    if (liked) await supabase.from("social_post_likes").delete().eq("post_id", postId).eq("user_id", uid);
    else await supabase.from("social_post_likes").insert([{ post_id: postId, user_id: uid }]);
  } catch (e) {}
}

export async function labAddComment(postId, text, mentions) {
  if (F()._labComments) {
    try { await supabase.from("lab_comments").insert([{ post_id: String(postId), user_id: F()._meUserId, author_name: F().user.name, content: text, mentions: mentions || [] }]); return true; }
    catch (e) { return false; }
  }
  try { await supabase.from("social_post_comments").insert([{ post_id: postId, author_id: F()._meId || F()._meUserId, content: text }]); return true; }
  catch (e) { return false; }
}

export async function labUpload(file) {
  try {
    const safe = String(file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `lab/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("chat-uploads").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
    return { url: data?.publicUrl || null, name: file.name, type: file.type };
  } catch (e) { return null; }
}
