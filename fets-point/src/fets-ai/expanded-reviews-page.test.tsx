import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { FetsIntelligence } from "../components/FetsIntelligence";

const fixture = vi.hoisted(() => ({ request: vi.fn(), userId: "u1", branch: "cochin" }));
vi.mock("./fets-ai-api", () => ({ agentRequest: fixture.request }));
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: { id: fixture.userId }, profile: { full_name: "Operator", role: "staff" } }) }));
vi.mock("../hooks/useBranch", () => ({ useBranch: () => ({ activeBranch: fixture.branch }) }));
vi.mock("../components/NewsManager", () => ({ NewsManager: () => <div>Broadcast workspace</div> }));
vi.mock("../components/Chat/GeminiLiveStudio", () => ({ GeminiLiveStudio: () => <div>Live workspace</div> }));

const review = {
  type: "change-review", id: "r1", operation: "update_case", label: "Update case",
  module: "Cases", path: "/case-management", branch: "cochin", status: "pending", applyMode: "database",
  recordId: "case-42", before: { status: "Open" }, proposed: { status: "Closed" },
  summary: "Close the selected case.", expiresAt: "2099-11-05T12:00:00Z",
};

beforeEach(() => {
  fixture.userId = "u1";
  fixture.branch = "cochin";
  fixture.request.mockReset();
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

it("provides a human Reviews queue to ordinary users without executing drafts on load", async () => {
  fixture.request.mockImplementation(async (body) => body.action === "reviews" ? { reviews: [review] }
    : body.action === "conversations" ? { conversations: [] } : { ready: true });
  render(<FetsIntelligence />);
  fireEvent.click(screen.getByRole("button", { name: "Reviews" }));
  await screen.findByText("case-42");
  expect(fixture.request).toHaveBeenCalledWith({ action: "reviews", branch: "cochin", page: "fets-intelligence" });
  expect(fixture.request.mock.calls.some(([body]) => body.action === "review-decide")).toBe(false);
  expect(screen.getByRole("button", { name: "Apply change" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Broadcasts" }));
  await screen.findByText("Broadcast workspace");
});

it("shows queue errors with an explicit read retry and a genuine empty state", async () => {
  let unavailable = true;
  fixture.request.mockImplementation(async (body) => {
    if (body.action === "reviews") {
      if (unavailable) throw new Error("Reviews are temporarily unavailable");
      return { reviews: [] };
    }
    return body.action === "conversations" ? { conversations: [] } : { ready: true };
  });
  render(<FetsIntelligence initialTab="reviews" />);
  await screen.findByText("Reviews are temporarily unavailable");
  expect(screen.queryByText("No reviews in this centre.")).not.toBeInTheDocument();
  unavailable = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry reviews" }));
  await screen.findByText("No reviews in this centre.");
});

it("discards a late previous identity and centre queue result", async () => {
  let finishOld: (value: unknown) => void = () => {};
  fixture.request.mockImplementation(async (body) => body.action === "reviews"
    ? body.branch === "cochin" ? new Promise((resolve) => { finishOld = resolve; }) : { reviews: [] }
    : body.action === "conversations" ? { conversations: [] } : { ready: true });
  const { rerender } = render(<FetsIntelligence initialTab="reviews" />);
  await waitFor(() => expect(fixture.request).toHaveBeenCalledWith(expect.objectContaining({ action: "reviews", branch: "cochin" })));
  fixture.userId = "u2";
  fixture.branch = "calicut";
  rerender(<FetsIntelligence initialTab="reviews" />);
  await screen.findByText("No reviews in this centre.");
  await act(async () => finishOld({ reviews: [review] }));
  expect(screen.queryByText("case-42")).not.toBeInTheDocument();
  expect(screen.getByText("No reviews in this centre.")).toBeInTheDocument();
});
