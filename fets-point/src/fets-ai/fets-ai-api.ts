import { supabase } from "../lib/supabase";
export type SourceEvidence = {
  source: string;
  page?: string;
  available: boolean;
  fetchedAt: string;
  truncated?: boolean;
  count?: number;
  documents?: {
    id: string;
    title: string;
    version: number;
    url?: string;
    updatedAt: string;
  }[];
};
export type HandoverProposal = {
  type: "handover-draft";
  branch: string;
  day: string;
  summary: string;
  followups: string;
  recognition: string;
  saved: false;
  requiresReview: true;
};
export type AgentSettings = {
  provider: "claude" | "gemini";
  gemini_model: string;
  claude_model: string;
  kill_switch: boolean;
  autonomous_enabled: boolean;
  max_tool_iterations: number;
};
export type ActionResult = {
  type: "action-result";
  tool: string;
  status: "succeeded" | "blocked" | "failed";
  recordId?: string;
  path?: string;
  title?: string;
  message?: string;
  replayed?: boolean;
};
export type MemoryRow = {
  id: string;
  scope: "user" | "branch" | "global";
  scope_ref?: string;
  category?: string;
  mem_key: string;
  mem_value: string;
  importance: number;
  is_active: boolean;
  created_by?: string;
  updated_at?: string;
};
export type KnowledgeRow = {
  id: string;
  title: string;
  category: string;
  content: string;
  branch: string;
  status: string;
  version: number;
  source: "legacy" | "approved";
  source_url?: string | null;
  updated_at: string;
};
export type Conversation = {
  id: string;
  title: string;
  branch: string;
  updated_at: string;
};
export type AgentReply = {
  text: string;
  evidence: SourceEvidence[];
  proposals: (
    | HandoverProposal
    | {
        type: "navigation";
        page: string;
        label: string;
        path: string;
      }
  )[];
  model: string;
  conversationId?: string;
  provider?: string;
  actions?: ActionResult[];
};
export type AgentStatus = {
  ready: boolean;
  liveReady?: boolean;
  databaseReady: boolean;
  modelReady: boolean;
  admin: boolean;
  branch: string;
  sources: {
    id: string;
    label: string;
    page: string;
  }[];
  liveModel: string;
  textModel: string;
  provider?: "gemini" | "claude";
  settings?: AgentSettings;
  providers?: {
    gemini: boolean;
    claude: boolean;
  };
  writesEnabled?: boolean;
  allowedActions?: string[];
  memoryCount?: number;
};
export async function agentRequest<T>(
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("fets-ai-agent", {
    body,
  });
  if (error) {
    const response = error.context as Response | undefined;
    let detail = "The assistant could not connect. Please try again.";
    try {
      const parsed = await response?.json();
      if (typeof parsed?.error === "string") detail = parsed.error;
    } catch {
      /* network error */
    }
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
