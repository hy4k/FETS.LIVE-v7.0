import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ profile: { id: "staff", full_name: "Training Staff" } }),
}));
vi.mock("../hooks/useBranch", () => ({
  useBranch: () => ({ activeBranch: "calicut" }),
}));
import NewsWorkspace from "./NewsWorkspace";
import {
  newsPost,
  industryPost,
  newsSource,
  newsDraft,
  newsConfig,
} from "../test/news-fixture";
const repo = () => ({
  context: vi.fn().mockResolvedValue({
    config: newsConfig,
    clients: [{ id: "client", name: "Example client" }],
    programmes: [],
  }),
  feed: vi.fn().mockResolvedValue({
    posts: [newsPost, industryPost],
    receipts: [],
    legacy: [],
  }),
  review: vi.fn().mockResolvedValue({
    drafts: [newsDraft],
    sources: [newsSource],
    runs: [],
    people: [],
  }),
  save: vi.fn().mockImplementation(async (d, p) => ({
    ...p,
    document: d,
    version: p.version + 1,
  })),
  publish: vi.fn().mockResolvedValue("post"),
  reject: vi.fn().mockResolvedValue(null),
  acknowledge: vi.fn().mockResolvedValue(null),
  withdraw: vi.fn().mockResolvedValue(null),
  revision: vi.fn().mockResolvedValue(newsDraft),
  domains: vi.fn().mockResolvedValue(newsConfig),
  collection: vi.fn().mockResolvedValue(newsConfig),
});
afterEach(cleanup);
it("staff see approved updates without original emails or approval controls", async () => {
  const r = repo();
  r.context.mockResolvedValue({
    config: { can_review: false },
    clients: [],
    programmes: [],
  });
  render(<NewsWorkspace repository={r} />);
  await screen.findByText("Updated pre-session checklist");
  expect(screen.queryByText(/PRIVATE SOURCE/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Review inbox/ }),
  ).not.toBeInTheDocument();
  expect(r.review).not.toHaveBeenCalled();
  expect(r.publish).not.toHaveBeenCalled();
});
it("an acknowledgement requires the actual staff click", async () => {
  const r = repo();
  r.context.mockResolvedValue({
    config: { can_review: false },
    clients: [],
    programmes: [],
  });
  render(<NewsWorkspace repository={r} />);
  await screen.findByText("Updated pre-session checklist");
  fireEvent.click(
    screen.getByRole("button", { name: "Updated pre-session checklist" }),
  );
  expect(r.acknowledge).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "I have read this update" }),
  );
  await waitFor(() => expect(r.acknowledge).toHaveBeenCalledWith(newsPost));
});
it("review shows the private source and publishes only after a deliberate approval", async () => {
  const r = repo();
  render(<NewsWorkspace repository={r} />);
  await screen.findByText("Updated pre-session checklist");
  fireEvent.click(screen.getByRole("button", { name: /Review inbox · 1/ }));
  fireEvent.click(
    screen.getByRole("button", { name: /Client briefing ready for review/ }),
  );
  expect(screen.getByText(/PRIVATE SOURCE/)).toBeVisible();
  expect(r.publish).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Approve & publish" }));
  await waitFor(() => expect(r.publish).toHaveBeenCalledWith(newsDraft));
});
it("edits must be saved before approval and are retained on save failure", async () => {
  const r = repo();
  r.save.mockRejectedValue(Error("Connection failed"));
  render(<NewsWorkspace repository={r} />);
  await screen.findByText("Updated pre-session checklist");
  fireEvent.click(screen.getByRole("button", { name: /Review inbox · 1/ }));
  fireEvent.click(
    screen.getByRole("button", { name: /Client briefing ready for review/ }),
  );
  const title = screen.getByLabelText("Title");
  fireEvent.change(title, { target: { value: "Edited before approval" } });
  expect(
    screen.getByRole("button", { name: "Approve & publish" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("alert");
  expect(title).toHaveValue("Edited before approval");
  expect(r.publish).not.toHaveBeenCalled();
});
it("news failures are visible without pretending there are no updates", async () => {
  const r = repo();
  r.feed.mockRejectedValue(Error("News service unavailable"));
  render(<NewsWorkspace repository={r} />);
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "News service unavailable",
  );
  expect(r.publish).not.toHaveBeenCalled();
});
