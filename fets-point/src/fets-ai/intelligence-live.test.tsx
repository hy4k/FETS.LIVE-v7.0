import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { FetsAIAgent } from "./FetsAIAgent";
const fixture = vi.hoisted(() => ({
  request: vi.fn(),
  configs: [] as any[],
  disconnect: vi.fn(),
}));
vi.mock("./fets-ai-api", () => ({ agentRequest: fixture.request }));
vi.mock("../lib/geminiLiveClient", () => ({
  GeminiLiveClient: class {
    config: any;
    constructor(config: any) {
      this.config = config;
      fixture.configs.push(config);
    }
    async connect() {
      await this.config.getSession();
      this.config.onStatusChange("connected");
    }
    disconnect() {
      fixture.disconnect();
    }
    isConnected() {
      return false;
    }
    updatePageContext() {}
  },
}));
beforeEach(() => {
  localStorage.clear();
  fixture.request.mockReset();
  fixture.configs.length = 0;
  fixture.disconnect.mockReset();
});
it("includes the restored conversation in voice setup and rejects late voice callbacks for a new identity", async () => {
  localStorage.setItem("fets-ai:conversation:u1:cochin", "c1");
  fixture.request.mockImplementation(async (b) =>
    b.action === "status"
      ? { ready: true, admin: false }
      : b.action === "conversations"
      ? { conversations: [{ id: "c1", title: "Saved", branch: "cochin" }] }
      : b.action === "conversation"
      ? { conversation: { id: "c1" }, messages: [] }
      : { token: "test-token", setup: {} }
  );
  const { rerender } = render(
    <FetsAIAgent
      userId="u1"
      branch="cochin"
      page="my-desk"
      navigate={vi.fn()}
    />
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Open FETS AI assistant" })
  );
  await screen.findByText("Connected to your workspace");
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "Conversation history" })
    ).toHaveValue("c1")
  );
  fireEvent.click(screen.getByRole("button", { name: "Live" }));
  fireEvent.click(screen.getByRole("button", { name: "Start live session" }));
  await waitFor(() =>
    expect(fixture.request).toHaveBeenCalledWith(
      expect.objectContaining({ action: "live-token", conversationId: "c1" })
    )
  );
  await act(async () => {
    rerender(
      <FetsAIAgent
        userId="u2"
        branch="cochin"
        page="my-desk"
        navigate={vi.fn()}
      />
    );
  });
  act(() =>
    fixture.configs[0].onTurnUpdate({
      id: "old",
      sender: "gemini",
      text: "Private old transcript",
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  expect(screen.queryByText("Private old transcript")).not.toBeInTheDocument();
  expect(fixture.disconnect).toHaveBeenCalled();
});
it("reuses a request UUID for repeated provider tool-call IDs and includes the user transcript", async () => {
  fixture.request.mockImplementation(async (b) =>
    b.action === "status"
      ? { ready: true, admin: false }
      : b.action === "conversations"
      ? { conversations: [] }
      : b.action === "tool"
      ? {
          result: {
            type: "action-result",
            tool: "create_task",
            status: "succeeded",
            recordId: "task1",
          },
        }
      : { token: "test-token", setup: {} }
  );
  render(
    <FetsAIAgent
      userId="u1"
      branch="cochin"
      page="my-desk"
      navigate={vi.fn()}
    />
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Open FETS AI assistant" })
  );
  await screen.findByText("Connected to your workspace");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "New chat" })).not.toBeDisabled()
  );
  fireEvent.click(screen.getByRole("button", { name: "Live" }));
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Start live session" }))
  );
  const config = fixture.configs[0];
  act(() =>
    config.onTurnUpdate({
      id: "user1",
      sender: "user",
      text: "Create a task to check the AC",
    })
  );
  await act(async () => {
    await config.executeTool(
      "create_task",
      { title: "Check AC" },
      "provider-call-001"
    );
    await config.executeTool(
      "create_task",
      { title: "Check AC" },
      "provider-call-001"
    );
  });
  const calls = fixture.request.mock.calls
    .filter(([b]) => b.action === "tool")
    .map(([b]) => b);
  expect(calls[0].requestId).toBe(calls[1].requestId);
  expect(calls[0].requestId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(calls[0].message).toBe("Create a task to check the AC");
});
it("allows Gemini voice when the selected Claude text provider is unavailable", async () => {
  fixture.request.mockImplementation(async (body) =>
    body.action === "status"
      ? {
          ready: false,
          liveReady: true,
          databaseReady: true,
          provider: "claude",
          providers: { claude: false, gemini: true },
          admin: false,
        }
      : body.action === "conversations"
      ? { conversations: [] }
      : { token: "test-token", setup: {} }
  );
  render(
    <FetsAIAgent
      userId="u1"
      branch="cochin"
      page="my-desk"
      navigate={vi.fn()}
    />
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Open FETS AI assistant" })
  );
  await screen.findByText(/Claude credential is pending/);
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "New chat" })).not.toBeDisabled()
  );
  fireEvent.click(screen.getByRole("button", { name: "Live" }));
  expect(
    screen.getByRole("button", { name: "Start live session" })
  ).not.toBeDisabled();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Start live session" }))
  );
  expect(fixture.request).toHaveBeenCalledWith(
    expect.objectContaining({ action: "live-token" })
  );
});
it("disables voice with a Gemini explanation even when Claude text is ready", async () => {
  fixture.request.mockImplementation(async (body) =>
    body.action === "status"
      ? {
          ready: true,
          liveReady: false,
          databaseReady: true,
          provider: "claude",
          providers: { claude: true, gemini: false },
          admin: false,
        }
      : { conversations: [] }
  );
  render(
    <FetsAIAgent
      userId="u1"
      branch="cochin"
      page="my-desk"
      navigate={vi.fn()}
    />
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Open FETS AI assistant" })
  );
  await screen.findByText("Connected to your workspace");
  fireEvent.click(screen.getByRole("button", { name: "Live" }));
  expect(
    screen.getByRole("button", { name: "Start live session" })
  ).toBeDisabled();
  expect(
    screen.getByText(/Gemini credential.*live sessions/)
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Start live session" }));
  expect(
    fixture.request.mock.calls.some(([body]) => body.action === "live-token")
  ).toBe(false);
});
