import { supabase } from "../lib/supabase";
import type {
  OutreachContext,
  OutreachDetail,
  InstituteInput,
  OutreachInstitute,
  CallInput,
  BatchInput,
  MockBatch,
  FollowupInput,
  OutreachFollowup,
} from "./types";
async function request(name: string, args?: Record<string, unknown>) {
  const result = args
    ? await supabase.rpc(name, args)
    : await supabase.rpc(name);
  if (result.error)
    throw new Error(
      result.error.message ||
        "Outreach information could not be saved or loaded."
    );
  if (!result.data || typeof result.data !== "object")
    throw new Error(
      "Outreach returned an incomplete response. Refresh before continuing."
    );
  return result.data;
}
export async function fetchOutreachContext(): Promise<OutreachContext> {
  const data = await request("outreach_context");
  if (
    typeof data.viewer?.user_id !== "string" ||
    typeof data.viewer?.can_manage !== "boolean" ||
    !["staff", "institutes", "followups", "batches"].every((key) =>
      Array.isArray(data[key])
    )
  )
    throw new Error(
      "Outreach returned incomplete workspace data. Refresh before continuing."
    );
  return data;
}
export async function fetchOutreachDetail(
  id: string,
  cursor?: { at: string; id: string } | null
): Promise<OutreachDetail> {
  const data = await request("outreach_detail", {
    p_institute_id: id,
    p_before: cursor?.at || null,
    p_before_id: cursor?.id || null,
  });
  if (
    data.institute?.id !== id ||
    !["calls", "followups", "batches"].every((key) =>
      Array.isArray(data[key])
    ) ||
    typeof data.has_more !== "boolean" ||
    (data.has_more && (!data.next_cursor?.at || !data.next_cursor?.id))
  )
    throw new Error(
      "Outreach returned incomplete institute history. Refresh before continuing."
    );
  return data;
}
export async function saveInstitute(
  input: InstituteInput
): Promise<OutreachInstitute> {
  const data = await request("outreach_save_institute", { p_payload: input });
  if (typeof data.id !== "string" || typeof data.updated_at !== "string")
    throw new Error(
      "Institute receipt is incomplete. Refresh before editing again."
    );
  return data;
}
export async function recordCall(
  input: CallInput
): Promise<{ call_id: string; institute: OutreachInstitute }> {
  const data = await request("outreach_record_call", { p_payload: input });
  if (
    typeof data.call_id !== "string" ||
    data.institute?.id !== input.institute_id
  )
    throw new Error(
      "Call receipt is incomplete. Refresh history before retrying."
    );
  return data;
}
export async function saveBatch(input: BatchInput): Promise<MockBatch> {
  const data = await request("outreach_save_batch", { p_payload: input });
  if (typeof data.id !== "string" || typeof data.updated_at !== "string")
    throw new Error(
      "Mock batch receipt is incomplete. Refresh before retrying."
    );
  return data;
}
export async function updateFollowup(
  input: FollowupInput
): Promise<OutreachFollowup> {
  const data = await request("outreach_update_followup", { p_payload: input });
  if (data.id !== input.id || typeof data.updated_at !== "string")
    throw new Error(
      "Follow-up receipt is incomplete. Refresh before retrying."
    );
  return data;
}
