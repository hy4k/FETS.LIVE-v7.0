import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import {
  fixturePlan,
  fixtureRecord,
  fixtureChecks,
  ids,
} from "../test/shift-v2-fixture";
const who = vi.hoisted(() => ({ id: "11111111-1111-4111-8111-111111111111" }));
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ profile: { id: who.id } }),
}));
import ShiftWorkspace from "./ShiftWorkspace";
const makeRepo = () => ({
  context: vi
    .fn()
    .mockResolvedValue({
      directory: [
        { profile_id: ids.support, role: "super_admin", branch: "*" },
      ],
      people: fixturePlan.people.filter((p) => !p.support),
      supportPeople: fixturePlan.people,
      sessions: [],
    }),
  load: vi.fn().mockResolvedValue({ record: fixtureRecord, events: [] }),
  checks: vi.fn().mockResolvedValue(fixtureChecks),
  save: vi.fn().mockResolvedValue(fixtureRecord),
  event: vi.fn().mockResolvedValue({}),
  recordCheck: vi.fn().mockResolvedValue({}),
  close: vi.fn().mockResolvedValue({}),
  prior: vi.fn().mockResolvedValue(null),
});
afterEach(() => {
  cleanup();
  who.id = ids.support;
});
it("opens the new timetable and a personal card without the previous Shift sections", async () => {
  const repo = makeRepo();
  render(
    <ShiftWorkspace branch="calicut" navigate={() => {}} repository={repo} />,
  );
  await screen.findByText("Example examination · sample timetable");
  fireEvent.click(screen.getByRole("button", { name: /^Alex 06:00/ }));
  expect(
    screen.getByRole("heading", { name: "Alex", exact: true }),
  ).toBeVisible();
  expect(screen.getByText(/Your opening tasks/)).toBeVisible();
  expect(screen.queryByText("Development review")).not.toBeInTheDocument();
});
it("staff land on their own sheet and cannot edit another person’s work", async () => {
  who.id = ids.a;
  const repo = makeRepo();
  render(
    <ShiftWorkspace branch="calicut" navigate={() => {}} repository={repo} />,
  );
  await screen.findByRole("heading", { name: "Alex", exact: true });
  expect(
    screen.queryByRole("button", { name: "Edit day plan" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Sam 06:00/ }));
  expect(
    screen.getByRole("heading", { name: "Sam", exact: true }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Mark done" }),
  ).not.toBeInTheDocument();
});
it("keeps editing drafts intact across a background reload", async () => {
  const repo = makeRepo();
  render(
    <ShiftWorkspace branch="calicut" navigate={() => {}} repository={repo} />,
  );
  await screen.findByRole("button", { name: "Edit day plan" });
  fireEvent.click(screen.getByRole("button", { name: "Edit day plan" }));
  const input = screen.getByLabelText("Client / programme context");
  fireEvent.change(input, { target: { value: "Unsaved daily plan" } });
  fireEvent.click(screen.getByRole("button", { name: "Refresh Shift" }));
  await waitFor(() => expect(repo.load).toHaveBeenCalledTimes(2));
  expect(input).toHaveValue("Unsaved daily plan");
});
it("shows a backend error rather than inventing a staff plan", async () => {
  const repo = makeRepo();
  repo.load.mockRejectedValue(Error("Backend unavailable"));
  render(
    <ShiftWorkspace branch="calicut" navigate={() => {}} repository={repo} />,
  );
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("heading", { name: "Alex" }),
  ).not.toBeInTheDocument();
});
