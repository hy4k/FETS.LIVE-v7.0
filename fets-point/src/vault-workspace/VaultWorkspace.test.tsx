import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VaultWorkspace from "./VaultWorkspace";
const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  update: vi.fn(),
  chain: null as any,
}));
const sample = {
  id: "newest",
  user_id: "signed-in-user",
  title: "Example portal",
  url: "https://example.test",
  username: "staff",
  password: "private-secret",
  notes: "Quick note",
  created_at: "2026-10-01",
  custom_fields: [{ key: "Reference", value: "private-reference" }],
};
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "signed-in-user" } }),
}));
vi.mock("../lib/supabase", () => ({ supabase: { from: () => mocks.chain } }));
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  mocks.chain = {
    select: () => mocks.chain,
    eq: (...args: any[]) => {
      mocks.eq(...args);
      return mocks.chain;
    },
    order: () => mocks.chain,
    range: () =>
      Promise.resolve({
        data: [
          sample,
          {
            ...sample,
            id: "older",
            created_at: "2026-01-01",
            notes: "Older note",
          },
        ],
        error: null,
      }),
    update: (payload: any) => {
      mocks.update(payload);
      return mocks.chain;
    },
    single: () => Promise.resolve({ data: sample, error: null }),
  };
});
afterEach(cleanup);
it("reads only the signed-in person’s entries, deduplicates cards and masks secrets in the dialog", async () => {
  render(<VaultWorkspace />);
  const card = await screen.findByRole("button", { name: /Example portal/ });
  expect(
    screen.getAllByRole("button", { name: /Example portal/ }),
  ).toHaveLength(1);
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "signed-in-user");
  expect(screen.queryByText("private-secret")).not.toBeInTheDocument();
  fireEvent.click(card);
  expect(screen.getByRole("dialog")).toHaveAttribute("open");
  expect(screen.queryByText("private-secret")).not.toBeInTheDocument();
  expect(screen.queryByText("private-reference")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show Password" }));
  expect(screen.getByText("private-secret")).toBeInTheDocument();
  fireEvent(window, new Event("blur"));
  expect(screen.queryByText("private-secret")).not.toBeInTheDocument();
});
it("saves only after explicit editing and preserves merged notes and additional fields", async () => {
  render(<VaultWorkspace />);
  fireEvent.click(
    await screen.findByRole("button", { name: /Example portal/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit entry" }));
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Updated portal" },
  });
  expect(mocks.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Updated portal",
        notes: "Quick note\nOlder note",
        custom_fields: sample.custom_fields,
      }),
    ),
  );
  expect(mocks.eq).toHaveBeenCalledWith("id", "newest");
});
