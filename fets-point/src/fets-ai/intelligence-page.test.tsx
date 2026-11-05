import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { FetsIntelligence } from "../components/FetsIntelligence";
const fixtures = vi.hoisted(() => ({
  request: vi.fn(),
  userId: "u1",
  branch: "cochin",
}));
vi.mock("./fets-ai-api", () => ({ agentRequest: fixtures.request }));
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: fixtures.userId },
    profile: { full_name: "Example Operator", role: "admin" },
  }),
}));
vi.mock("../hooks/useBranch", () => ({
  useBranch: () => ({ activeBranch: fixtures.branch }),
}));
vi.mock("../components/NewsManager", () => ({
  NewsManager: () => <div>Existing News workspace</div>,
}));
vi.mock("../components/Chat/GeminiLiveStudio", () => ({
  GeminiLiveStudio: () => <div>Existing Live entry</div>,
}));
beforeEach(() => {
  fixtures.request.mockReset();
  localStorage.clear();
  fixtures.userId = "u1";
  fixtures.branch = "cochin";
  Element.prototype.scrollIntoView = vi.fn();
});
it("waits for real status, displays saved action evidence, and preserves Broadcasts", async () => {
  let resolveStatus: (v: any) => void;
  fixtures.request.mockImplementation(async (b) =>
    b.action === "status"
      ? new Promise((resolve) => {
          resolveStatus = resolve;
        })
      : b.action === "conversations"
      ? { conversations: [] }
      : {
          text: "Task saved.",
          conversationId: "c1",
          model: "real-model",
          actions: [
            {
              type: "action-result",
              tool: "create_task",
              status: "succeeded",
              recordId: "t1",
              path: "/actionables",
            },
          ],
          evidence: [
            {
              source: "Current Shift",
              available: true,
              page: "handover",
              fetchedAt: "2026-10-30",
            },
          ],
          proposals: [],
        }
  );
  render(<FetsIntelligence />);
  expect(screen.queryByText(/Copilot · Connected/)).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText(/Message FETS AI/)).toBeDisabled();
  resolveStatus!({ ready: true, textModel: "real-model" });
  await screen.findByText(/Copilot · Connected/);
  fireEvent.change(screen.getByPlaceholderText(/Message FETS AI/), {
    target: { value: "Create task" },
  });
  fireEvent.submit(
    screen.getByPlaceholderText(/Message FETS AI/).closest("form")!
  );
  await screen.findByText("t1");
  expect(
    screen.getByRole("button", { name: "Current Shift" })
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Broadcasts" }));
  await screen.findByText("Existing News workspace");
});
it("removes previous identity messages and scopes every next request after account change", async () => {
  fixtures.request.mockImplementation(async (b) =>
    b.action === "status"
      ? { ready: true }
      : b.action === "conversations"
      ? { conversations: [] }
      : {
          text: "Private u1 response",
          conversationId: "c1",
          evidence: [],
          proposals: [],
        }
  );
  const { rerender } = render(<FetsIntelligence />);
  await screen.findByText(/Copilot · Connected/);
  fireEvent.change(screen.getByPlaceholderText(/Message FETS AI/), {
    target: { value: "Private question" },
  });
  fireEvent.submit(
    screen.getByPlaceholderText(/Message FETS AI/).closest("form")!
  );
  await screen.findByText("Private u1 response");
  fixtures.userId = "u2";
  fixtures.branch = "calicut";
  rerender(<FetsIntelligence />);
  await waitFor(() =>
    expect(screen.queryByText("Private u1 response")).not.toBeInTheDocument()
  );
  await waitFor(() =>
    expect(fixtures.request).toHaveBeenCalledWith(
      expect.objectContaining({ action: "conversations", branch: "calicut" })
    )
  );
});
