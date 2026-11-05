import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AgentResults } from "./AgentResults";

const request = vi.hoisted(() => vi.fn());
vi.mock("./fets-ai-api", () => ({ agentRequest: request }));

const pending = {
  type: "change-review" as const,
  id: "review-001",
  operation: "staff_update",
  label: "Update staff details",
  module: "Staff",
  path: "/staff",
  branch: "cochin",
  status: "pending" as const,
  applyMode: "database" as const,
  recordId: "staff-123",
  before: { full_name: "Original Name", is_active: true },
  proposed: { full_name: "Proposed Name", is_active: false },
  summary: "Update the selected staff member.",
  expiresAt: "2099-11-05T12:00:00Z",
  createdAt: "2026-11-05T10:00:00Z",
};

beforeEach(() => { request.mockReset(); });
afterEach(() => vi.useRealTimers());

it("renders the stored review target and both values without executing the preview", () => {
  render(<AgentResults reply={{ proposals: [pending] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  expect(screen.getByRole("heading", { name: "Update staff details" })).toBeInTheDocument();
  expect(screen.getByText("Original Name")).toBeInTheDocument();
  expect(screen.getByText("Proposed Name")).toBeInTheDocument();
  expect(screen.getByText("staff-123")).toBeInTheDocument();
  expect(screen.getByText("cochin")).toBeInTheDocument();
  expect(screen.getByText("review-001")).toBeInTheDocument();
  expect(screen.getByText(/Expires/)).toBeInTheDocument();
  expect(screen.getByText(/Nothing has been applied/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Apply change" })).toBeEnabled();
  expect(request).not.toHaveBeenCalled();
});

it("offers an honest module handoff without an Apply button or unsafe links", () => {
  const { rerender } = render(<AgentResults reply={{ proposals: [{ ...pending, applyMode: "module" }] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  expect(screen.getByText(/Not applied; review in module/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Apply change" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Review in Staff" })).toHaveAttribute("href", "/staff");
  expect(request).not.toHaveBeenCalled();
  rerender(<AgentResults reply={{ proposals: [{ ...pending, applyMode: "module", path: "//external.example" }] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("applies only a deliberate decision for the stored review ID and disables duplicate decisions", async () => {
  let finish: (value: unknown) => void = () => {};
  request.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<AgentResults reply={{ proposals: [pending] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  const apply = screen.getByRole("button", { name: "Apply change" });
  fireEvent.click(apply);
  fireEvent.click(apply);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith({ action: "review-decide", reviewId: "review-001", decision: "apply", branch: "cochin", page: "fets-intelligence" });
  expect(screen.getByRole("button", { name: /Applying/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel review" })).toBeDisabled();
  expect(screen.queryByText("Applied")).not.toBeInTheDocument();
  await act(async () => finish({ review: { ...pending, status: "applied", result: { type: "action-result", tool: "staff_update", status: "succeeded", message: "Staff details saved.", recordId: "staff-123" } } }));
  expect(screen.getByText("Applied")).toBeInTheDocument();
  expect(screen.getByText("Staff details saved.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Apply change" })).not.toBeInTheDocument();
});

it("cancels only from the separate deliberate Cancel button", async () => {
  request.mockResolvedValue({ review: { ...pending, status: "cancelled" } });
  render(<AgentResults reply={{ proposals: [pending] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Cancel review" }));
  await screen.findByText("Cancelled");
  expect(request).toHaveBeenCalledWith({ action: "review-decide", reviewId: "review-001", decision: "cancel", branch: "cochin", page: "fets-intelligence" });
  expect(screen.queryByRole("button", { name: "Apply change" })).not.toBeInTheDocument();
});

it("keeps the decision locked when the same preview is rendered again during Apply", async () => {
  let finish: (value: unknown) => void = () => {};
  request.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const { rerender } = render(<AgentResults reply={{ proposals: [{ ...pending }] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
  rerender(<AgentResults reply={{ proposals: [{ ...pending }] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  expect(screen.getByRole("button", { name: /Applying/ })).toBeDisabled();
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => finish({ review: { ...pending, status: "applied" } }));
  expect(screen.getByText("Applied")).toBeInTheDocument();
});

it("shows an unscoped preview with disabled decisions", () => {
  render(<AgentResults reply={{ proposals: [pending] } as any} />);
  expect(screen.getByText("Proposed Name")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Apply change" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel review" })).toBeDisabled();
  expect(request).not.toHaveBeenCalled();
});

it("requires a read after an uncertain API failure and never retries Apply automatically", async () => {
  request.mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValueOnce({ review: { ...pending, status: "stale" } });
  render(<AgentResults reply={{ proposals: [pending] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent("Connection interrupted");
  expect(screen.getByRole("button", { name: "Apply change" })).toBeDisabled();
  expect(screen.queryByText("Applied")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh review" }));
  await screen.findByText("Changed since preview");
  expect(screen.getByText(/Ask for a new preview/)).toBeInTheDocument();
  expect(request.mock.calls.map(([body]) => body.action)).toEqual(["review-decide", "review"]);
});

it("expires an open preview locally and prevents Apply", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
  render(<AgentResults reply={{ proposals: [{ ...pending, expiresAt: "2026-11-05T10:00:01Z" }] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  expect(screen.getByRole("button", { name: "Apply change" })).toBeEnabled();
  act(() => vi.advanceTimersByTime(1001));
  expect(screen.getByText("Expired")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Apply change" })).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
});

it("hides previous account details immediately and ignores its late decision result", async () => {
  let finishDecision: (value: unknown) => void = () => {};
  request.mockImplementation((body) => body.action === "review-decide"
    ? new Promise((resolve) => { finishDecision = resolve; })
    : Promise.reject(new Error("Review is not available for this account.")));
  const { rerender } = render(<AgentResults reply={{ proposals: [pending] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
  rerender(<AgentResults reply={{ proposals: [pending] } as any} reviewScope={{ userId: "u2", branch: "cochin" }} />);
  expect(screen.queryByText("Original Name")).not.toBeInTheDocument();
  await screen.findByText("Review is not available for this account.");
  await act(async () => finishDecision({ review: { ...pending, status: "applied" } }));
  expect(screen.queryByText("Applied")).not.toBeInTheDocument();
  expect(screen.queryByText("Original Name")).not.toBeInTheDocument();
});

it("hides a previous centre review and never submits it from the new centre", async () => {
  const { rerender } = render(<AgentResults reply={{ proposals: [pending] } as any} reviewScope={{ userId: "u1", branch: "cochin" }} />);
  rerender(<AgentResults reply={{ proposals: [pending] } as any} reviewScope={{ userId: "u1", branch: "calicut" }} />);
  expect(screen.queryByText("Original Name")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Apply change" })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/selected centre/)).toBeInTheDocument());
  expect(request).not.toHaveBeenCalled();
});
