import {
  emptyDocument,
  type Draft,
  type Post,
  type Source,
  type Receipt,
} from "../news-workspace/model";
const today = new Date().toISOString();
export const newsPost: Post = {
  id: "00000000-0000-4000-8000-000000000001",
  draft_id: "00000000-0000-4000-8000-000000000002",
  kind: "client",
  document: {
    ...emptyDocument(),
    title: "Updated pre-session checklist",
    summary:
      "A fictional training update to demonstrate clear staff instructions.",
    body: "Use the approved checklist for the named programme only. The current edition is available to assigned staff.",
    action: "Read the current checklist before your next assigned session.",
    why: "One approved reference keeps preparation consistent.",
    branch: "global",
    client_id: "client",
    priority: "important",
    requires_ack: true,
    related_page: "calendar",
  },
  source_label: "Example client · training data",
  source_date: today,
  source_url: null,
  approved_by: "11111111-1111-4111-8111-111111111111",
  published_at: today,
  supersedes_id: null,
  state: "live",
  withdrawal_reason: "",
  withdrawn_at: null,
};
export const industryPost: Post = {
  ...newsPost,
  id: "00000000-0000-4000-8000-000000000003",
  draft_id: "00000000-0000-4000-8000-000000000004",
  kind: "industry",
  document: {
    ...emptyDocument(),
    title: "Assessment delivery: an industry update",
    summary:
      "Fictional training content about developments in computer-based assessment.",
    why: "Useful background for staff learning.",
    action:
      "For awareness. Continue to follow the current client instructions.",
    body: "Training preview only; this is not a real news announcement.",
    branch: "global",
  },
  source_label: "Example industry source · training data",
  source_url: "https://example.org/training",
};
export const newsSource: Source = {
  id: "00000000-0000-4000-8000-000000000010",
  kind: "client",
  external_key: "fictional-message",
  source_label: "Example client · training data",
  domain: "example.org",
  sender: "training@example.org",
  source_date: today,
  public_url: null,
  private_reference: "https://example.org/private-training-email",
  excerpt:
    "PRIVATE SOURCE · fictional original for the reviewer. A programme-wide update is available for review. No candidate data.",
  verification:
    "Fictional verified-source fixture; no external request is made.",
  collected_at: today,
};
export const newsDraft: Draft = {
  id: "00000000-0000-4000-8000-000000000011",
  source_id: newsSource.id,
  kind: "client",
  document: { ...newsPost.document, title: "Client briefing ready for review" },
  status: "review",
  revision_of: null,
  version: 1,
  review_note: "",
  created_at: today,
  updated_at: today,
};
export const newsConfig = {
  can_review: true,
  client_scheduled: true,
  industry_scheduled: true,
  mailbox: "training@example.org",
  client_enabled: true,
  industry_enabled: true,
  approval_required: true,
  domains: ["example.org"],
};
