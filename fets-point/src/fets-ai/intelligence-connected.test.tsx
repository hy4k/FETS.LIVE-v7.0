import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SettingsPanel } from "../components/fetsai/SettingsPanel";
import { DataVaultPanel } from "../components/fetsai/DataVaultPanel";
import { TelemetryPanel } from "../components/fetsai/TelemetryPanel";
import { useAgentConversation } from "./useAgentConversation";
import { AgentResults } from "./AgentResults";
const request = vi.hoisted(() => vi.fn());
vi.mock("./fets-ai-api", () => ({ agentRequest: request }));
const status = {
  ready: true,
  admin: true,
  textModel: "actual-gemini",
  provider: "gemini",
  providers: { gemini: true, claude: false },
  writesEnabled: false,
  allowedActions: [],
  settings: {
    provider: "gemini",
    gemini_model: "actual-gemini",
    claude_model: "claude-model",
    kill_switch: true,
    autonomous_enabled: false,
    max_tool_iterations: 5,
  },
};
beforeEach(() => {
  request.mockReset();
  localStorage.clear();
});
it("uses server settings and sends the operational switch to the active backend", async () => {
  request.mockImplementation(async (b) =>
    b.action === "settings-update" ? { ...status, writesEnabled: true } : status
  );
  render(<SettingsPanel isAdmin userId="u1" branch="cochin" />);
  await screen.findByText("actual-gemini");
  expect(screen.getByRole("button", { name: /Claude/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("switch", { name: "Autonomous Writes" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "settings-update",
        branch: "cochin",
        changes: { kill_switch: false, autonomous_enabled: true },
      })
    )
  );
  await screen.findByText(/writes enabled/i);
});
it("edits and disables saved personal pinned memory through the agent API", async () => {
  const memory = {
    id: "m1",
    mem_key: "Language",
    mem_value: "English",
    scope: "user",
    is_active: true,
    importance: 3,
  };
  request.mockImplementation(async (b) =>
    b.action === "memories"
      ? { memories: [memory] }
      : b.action === "knowledge"
      ? { documents: [] }
      : { memory: { ...memory, mem_value: b.value } }
  );
  render(<DataVaultPanel userId="u1" branch="cochin" isAdmin={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Pinned Memory" }));
  await screen.findByText("Language");
  fireEvent.click(screen.getByRole("button", { name: "Edit Language" }));
  fireEvent.change(screen.getByLabelText("Memory value"), {
    target: { value: "English and India time" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save memory" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "memory-save",
        id: "m1",
        value: "English and India time",
        scope: "user",
      })
    )
  );
  fireEvent.click(screen.getByRole("button", { name: "Disable Language" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ action: "memory-delete", id: "m1" })
    )
  );
});
it("shows telemetry errors with retry instead of fabricated zero counters", async () => {
  request.mockRejectedValue(new Error("Audit service unavailable"));
  render(<TelemetryPanel userId="u1" branch="cochin" />);
  await screen.findByText("Audit service unavailable");
  expect(screen.queryByText("Writes Executed")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
});
it("restores owned history and sends stable request IDs without caller supplied history", async () => {
  localStorage.setItem("fets-ai:conversation:u1:cochin", "c1");
  request.mockImplementation(async (b) =>
    b.action === "conversations"
      ? { conversations: [{ id: "c1", title: "Saved chat", branch: "cochin" }] }
      : b.action === "conversation"
      ? {
          conversation: { id: "c1" },
          messages: [
            {
              id: "a1",
              role: "assistant",
              content: "Saved answer",
              metadata: {},
              created_at: "2026-10-30",
            },
          ],
        }
      : {
          text: "New answer",
          conversationId: "c1",
          evidence: [],
          proposals: [],
        }
  );
  const { result } = renderHook(() =>
    useAgentConversation("u1", "cochin", "my-desk")
  );
  await waitFor(() =>
    expect(result.current.messages[0]?.content).toBe("Saved answer")
  );
  await act(() => result.current.send("Follow up"));
  const sent = request.mock.calls.find(([b]) => b.action === "chat")![0];
  expect(sent.conversationId).toBe("c1");
  expect(sent.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(sent.history).toBeUndefined();
  act(() => result.current.newChat());
  expect(result.current.messages).toEqual([]);
  expect(result.current.conversationId).toBeUndefined();
});
it("discards an old identity reply and clears loading on account change", async () => {
  let resolveReply: (v: any) => void;
  request.mockImplementation(async (b) =>
    b.action === "conversations"
      ? { conversations: [] }
      : new Promise((resolve) => {
          resolveReply = resolve;
        })
  );
  const { result, rerender } = renderHook(
    ({ userId }) => useAgentConversation(userId, "cochin", "my-desk"),
    { initialProps: { userId: "u1" } }
  );
  await waitFor(() => expect(result.current.restoring).toBe(false));
  let sending: Promise<void>;
  act(() => {
    sending = result.current.send("Private request");
  });
  rerender({ userId: "u2" });
  await waitFor(() => expect(result.current.busy).toBe(false));
  await act(async () => {
    resolveReply!({
      text: "Private old answer",
      conversationId: "old",
      evidence: [],
      proposals: [],
    });
    await sending;
  });
  expect(result.current.messages).toEqual([]);
  expect(localStorage.getItem("fets-ai:conversation:u2:cochin")).toBeNull();
});
it("renders evidence, confirmed record IDs and review-only proposals", () => {
  render(
    <AgentResults
      reply={{
        evidence: [
          {
            source: "Calendar",
            page: "calendar",
            available: true,
            fetchedAt: "2026-10-30",
          },
        ],
        actions: [
          {
            type: "action-result",
            tool: "create_task",
            status: "succeeded",
            recordId: "real-123",
            path: "/actionables",
          },
        ],
        proposals: [
          {
            type: "handover-draft",
            branch: "cochin",
            day: "2026-10-30",
            summary: "Review this",
            followups: "",
            recognition: "",
            saved: false,
            requiresReview: true,
          },
        ],
      }}
    />
  );
  expect(screen.getByText("real-123")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Open module/ })
  ).toHaveAttribute("href", "/actionables");
  expect(screen.getByText(/Nothing has been submitted/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument();
});
it("retries a failed chat with the same request UUID and clears it for a new chat", async () => {
  let fail = true;
  request.mockImplementation(async (b) => {
    if (b.action === "conversations") return { conversations: [] };
    if (fail) throw new Error("Temporary error");
    return { text: "Saved", conversationId: "c1", evidence: [], proposals: [] };
  });
  const { result } = renderHook(() =>
    useAgentConversation("u1", "cochin", "my-desk")
  );
  await waitFor(() => expect(result.current.restoring).toBe(false));
  await act(() => result.current.send("Create task"));
  expect(result.current.error).toBe("Temporary error");
  fail = false;
  await act(() => result.current.send("Create task"));
  const sent = request.mock.calls
    .filter(([b]) => b.action === "chat")
    .map(([b]) => b);
  expect(sent[0].requestId).toBe(sent[1].requestId);
  expect(result.current.messages.filter((m) => m.role === "user")).toHaveLength(
    1
  );
  act(() => result.current.newChat());
  await act(() => result.current.send("Create task"));
  const last = request.mock.calls
    .filter(([b]) => b.action === "chat")
    .slice(-1)[0][0];
  expect(last.requestId).not.toBe(sent[0].requestId);
  expect(last.conversationId).toBeUndefined();
});
it("discards late settings updates after the account changes", async () => {
  let resolveSave: (v: any) => void;
  request.mockImplementation(async (b) =>
    b.action === "settings-update"
      ? new Promise((resolve) => {
          resolveSave = resolve;
        })
      : b.branch === "calicut"
      ? { ...status, textModel: "new-centre-model" }
      : status
  );
  const { rerender } = render(
    <SettingsPanel isAdmin userId="u1" branch="cochin" />
  );
  await screen.findByText("actual-gemini");
  fireEvent.click(screen.getByRole("switch", { name: "Autonomous Writes" }));
  rerender(<SettingsPanel isAdmin userId="u2" branch="calicut" />);
  await screen.findByText("new-centre-model");
  await act(async () => resolveSave!({ ...status, writesEnabled: true }));
  expect(screen.getByText("new-centre-model")).toBeInTheDocument();
  expect(screen.queryByText("Live — writes enabled")).not.toBeInTheDocument();
});
it("shares the selected private conversation between page and companion for live setup", async () => {
  request.mockImplementation(async (b) =>
    b.action === "conversations"
      ? { conversations: [] }
      : b.action === "conversation"
      ? {
          conversation: { id: "c1", title: "Shared chat", branch: "cochin" },
          messages: [
            {
              id: "saved1",
              role: "assistant",
              content: "Persisted reply",
              metadata: {},
              created_at: "2026-10-30",
            },
          ],
        }
      : {
          text: "Persisted reply",
          conversationId: "c1",
          evidence: [],
          proposals: [],
        }
  );
  const { result } = renderHook(() => ({
    page: useAgentConversation("u1", "cochin", "fets-intelligence"),
    companion: useAgentConversation("u1", "cochin", "my-desk"),
  }));
  await waitFor(() =>
    expect(
      result.current.page.restoring || result.current.companion.restoring
    ).toBe(false)
  );
  await act(() => result.current.page.send("Question"));
  await waitFor(() =>
    expect(result.current.companion.conversationId).toBe("c1")
  );
  expect(result.current.companion.messages[0]?.content).toBe("Persisted reply");
  act(() => result.current.companion.newChat());
  await waitFor(() => expect(result.current.page.messages).toEqual([]));
});
it("retries a failed history read without sending a model message", async () => {
  request
    .mockRejectedValueOnce(new Error("History unavailable"))
    .mockResolvedValue({ conversations: [] });
  const { result } = renderHook(() =>
    useAgentConversation("u1", "cochin", "my-desk")
  );
  await waitFor(() => expect(result.current.error).toBe("History unavailable"));
  await act(() => result.current.retry());
  await waitFor(() => expect(result.current.error).toBe(""));
  expect(
    request.mock.calls.every(([body]) => body.action === "conversations")
  ).toBe(true);
});
it("preserves an approved knowledge source link and edits with the saved version", async () => {
  const document = {
    id: "d1",
    title: "SOP",
    category: "policy",
    content: "Approved reference content",
    branch: "cochin",
    status: "published",
    version: 4,
    source: "approved",
    source_url: "https://example.org/sop",
  };
  request.mockImplementation(async (b) =>
    b.action === "memories"
      ? { memories: [] }
      : b.action === "knowledge"
      ? { documents: [document] }
      : { document }
  );
  render(<DataVaultPanel userId="u1" branch="cochin" isAdmin />);
  await screen.findByText("SOP");
  fireEvent.click(screen.getByRole("button", { name: "Edit SOP" }));
  expect(screen.getByLabelText("Source link · optional")).toHaveValue(
    "https://example.org/sop"
  );
  fireEvent.click(screen.getByRole("button", { name: "Save knowledge" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "knowledge-save",
        document: expect.objectContaining({
          id: "d1",
          source: "approved",
          version: 4,
          source_url: "https://example.org/sop",
        }),
      })
    )
  );
});
