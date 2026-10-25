import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const f = vi.hoisted(() => ({
  insert: vi.fn(),
  profile: { role: "super_admin" },
  clients: [{ id: "p", name: "PARAGON" }],
  exams: [{ id: "c", name: "CELPIP", client_id: "p", locations: ["calicut"] }],
}));
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ profile: f.profile }),
}));
vi.mock("../hooks/useClients", () => ({
  useClients: () => ({ data: f.clients }),
  useClientExams: () => ({ data: f.exams }),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      insert: (value: any) => {
        f.insert(table, value);
        return {
          select: () => ({
            single: async () => ({ data: { id: "new" }, error: null }),
          }),
        };
      },
    }),
  },
}));
import { ClientDirectory } from "./ClientDirectory";
afterEach(() => {
  cleanup();
  f.insert.mockClear();
  f.profile = { role: "super_admin" };
});
function open() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ClientDirectory />
    </QueryClientProvider>,
  );
}
it("saves client and linked programme into the shared tables", async () => {
  open();
  fireEvent.change(screen.getByLabelText("New client / provider"), {
    target: { value: "new provider" },
  });
  fireEvent.click(screen.getByText("Add client"));
  await screen.findByText(/NEW PROVIDER saved/);
  expect(f.insert).toHaveBeenCalledWith("clients", {
    name: "NEW PROVIDER",
    color: "teal",
  });
  fireEvent.change(screen.getByLabelText("New exam programme"), {
    target: { value: "New exam" },
  });
  fireEvent.click(screen.getByText("Add programme"));
  await waitFor(() =>
    expect(f.insert).toHaveBeenCalledWith("client_exams", {
      client_id: "p",
      name: "NEW EXAM",
      locations: ["calicut", "cochin"],
    }),
  );
});
it("prevents duplicate client names with different case", () => {
  open();
  fireEvent.change(screen.getByLabelText("New client / provider"), {
    target: { value: " paragon " },
  });
  fireEvent.click(screen.getByText("Add client"));
  expect(screen.getByRole("alert")).toHaveTextContent("already exists");
  expect(f.insert).not.toHaveBeenCalled();
});
it("staff can read the shared catalogue without management controls", () => {
  f.profile = { role: "staff" };
  open();
  expect(screen.getByText("CELPIP")).toBeVisible();
  expect(screen.queryByText("Add client")).not.toBeInTheDocument();
});
