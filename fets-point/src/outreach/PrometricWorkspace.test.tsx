import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "../contexts/AuthContextValue";
import PrometricWorkspace from "./PrometricWorkspace";
import type {
  OutreachContext,
  OutreachDetail,
  OutreachInstitute,
  OutreachCall,
} from "./types";

const api = vi.hoisted(() => ({
  fetchOutreachContext: vi.fn(),
  fetchOutreachDetail: vi.fn(),
  saveInstitute: vi.fn(),
  recordCall: vi.fn(),
  saveBatch: vi.fn(),
  updateFollowup: vi.fn(),
}));
vi.mock("./api", () => api);
const institute: OutreachInstitute = {
  id: "inst-1",
  name: "Example Business Institute",
  city: "Kochi",
  state: "Kerala",
  contact_name: "Office coordinator",
  contact_role: "Director",
  phone: "12345",
  email: "office@example.test",
  website: "",
  preferred_centre: "cochin",
  owner_user_id: "user-1",
  stage: "interested",
  contact_permission: "allowed",
  interest: "centre_mock",
  notes: "Discuss centre readiness",
  last_contact_at: null,
  created_at: "2026-11-01T06:00:00Z",
  updated_at: "2026-11-07T06:00:00Z",
};
let context: OutreachContext;
let detail: OutreachDetail;
const call = (id: string): OutreachCall => ({
  id,
  institute_id: institute.id,
  actor_user_id: "user-1",
  actor_name: "Current staff",
  occurred_at: "2026-11-06T06:00:00Z",
  channel: "phone",
  outcome: "interested",
  contact_name: "Office coordinator",
  contact_role: "Director",
  summary: `Conversation ${id}`,
  answers: {
    annual_students: 30,
    exam_cycle: "November",
    booking_influence: "",
    main_worries: "Travel",
    student_queries: "",
    current_mock_format: "Institute lab",
    environment_gap: "",
    readiness_needs: "",
    expectations: "",
    improvements: "",
  },
  concerns: ["travel"],
  interest: "centre_mock",
  follow_up_permission: "allowed",
  advisory_interest: "not_asked",
  close_reason: "",
  created_at: "2026-11-06T06:00:00Z",
});
function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onBack = vi.fn();
  const auth = {
    user: { id: "user-1" } as any,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    profile: null,
    hasPermission: () => true,
  };
  render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={client}>
        <PrometricWorkspace onBack={onBack} />
      </QueryClientProvider>
    </AuthContext.Provider>
  );
  return { client, onBack };
}
beforeEach(() => {
  context = {
    viewer: { user_id: "user-1", can_manage: false },
    staff: [
      { user_id: "user-1", full_name: "Current staff" },
      { user_id: "user-2", full_name: "Other staff" },
    ],
    institutes: [],
    followups: [],
    batches: [],
  };
  detail = {
    institute,
    calls: [],
    followups: [],
    batches: [],
    has_more: false,
    next_cursor: null,
  };
  Object.values(api).forEach((fn) => fn.mockReset());
  api.fetchOutreachContext.mockImplementation(async () => context);
  api.fetchOutreachDetail.mockImplementation(async () => detail);
});
describe("Prometric institute workspace", () => {
  it("opens the call guide even with no institutes and returns to Actionables", async () => {
    const { onBack } = show();
    await screen.findByText("Add your first institute");
    screen.getByRole("button", { name: "Call guide" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "Call guide" }));
    const guide = screen.getByRole("dialog", { name: "Call guide" });
    expect(
      within(guide).getByText(/Introduce yourself and ask permission/)
    ).toBeInTheDocument();
    fireEvent.keyDown(guide, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Call guide" })).toHaveFocus();
    fireEvent.click(
      screen.getByRole("button", { name: "Back to Actionables" })
    );
    expect(onBack).toHaveBeenCalledOnce();
  });
  it("shows a load failure without reporting zero candidates as loaded data", async () => {
    api.fetchOutreachContext.mockRejectedValue(
      new Error("Actionables access required")
    );
    show();
    expect(
      await screen.findByRole("alert", {}, { timeout: 4000 })
    ).toHaveTextContent("Actionables access required");
    expect(
      screen.queryByRole("region", { name: "Candidate pipeline" })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Retry workspace" })
    ).toBeEnabled();
  });
  it("uses actual queue and search selectors to find an institute needing a next step", async () => {
    context.institutes = [
      institute,
      { ...institute, id: "inst-2", name: "Closed Institute", stage: "closed" },
    ];
    show();
    await screen.findByRole("button", {
      name: /Open Example Business Institute/,
    });
    fireEvent.click(screen.getByRole("button", { name: /Needs next step/ }));
    expect(
      screen.queryByRole("button", { name: /Open Closed Institute/ })
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Search institutes"), {
      target: { value: "not present" },
    });
    expect(
      screen.getByText("No institutes match these filters.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(
      screen.getByRole("button", { name: /Open Closed Institute/ })
    ).toBeInTheDocument();
  });
  it("keeps incoming and platform numbers in separate ledgers", async () => {
    context.institutes = [institute];
    context.batches = [
      {
        id: "batch-1",
        institute_id: "inst-1",
        name: "First cohort",
        delivery: "fets_centre",
        centre: "cochin",
        planned_date: null,
        status: "potential",
        estimated: 25,
        confirmed: 0,
        attended: 0,
        notes: "",
        created_at: institute.created_at,
        updated_at: institute.updated_at,
      },
      {
        id: "batch-2",
        institute_id: "inst-1",
        name: "Second cohort",
        delivery: "institute_platform",
        centre: null,
        planned_date: null,
        status: "confirmed",
        estimated: 50,
        confirmed: 18,
        attended: 0,
        notes: "",
        created_at: institute.created_at,
        updated_at: institute.updated_at,
      },
    ];
    show();
    const ledger = await screen.findByRole("region", {
      name: "Candidate pipeline",
    });
    expect(
      within(ledger).getByLabelText("Incoming estimated candidates")
    ).toHaveTextContent("25");
    expect(
      within(ledger).getByLabelText("Platform confirmed candidates")
    ).toHaveTextContent("18");
    expect(
      within(ledger).getByRole("link", { name: "Review Calendar capacity" })
    ).toHaveAttribute("href", "/calendar");
  });
  it("loads read-only conversation history and appends older calls", async () => {
    context.institutes = [institute];
    detail.calls = [call("recent")];
    detail.has_more = true;
    detail.next_cursor = { at: institute.created_at, id: "recent" };
    api.fetchOutreachDetail.mockImplementation(async (_id, cursor) =>
      cursor
        ? {
            ...detail,
            calls: [call("older")],
            has_more: false,
            next_cursor: null,
          }
        : detail
    );
    show();
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Open Example Business Institute/,
      })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "History" }));
    expect(await screen.findByText("Conversation recent")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Delete|Edit conversation/ })
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Load older conversations" })
    );
    expect(await screen.findByText("Conversation older")).toBeInTheDocument();
    expect(screen.getByText("Conversation recent")).toBeInTheDocument();
    expect(api.fetchOutreachDetail).toHaveBeenLastCalledWith("inst-1", {
      at: institute.created_at,
      id: "recent",
    });
  });
  it("clears the detail when access to an institute is lost after reassignment", async () => {
    context.institutes = [institute];
    const { client } = show();
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Open Example Business Institute/,
      })
    );
    fireEvent.click(
      await screen.findByRole("tab", { name: "Log conversation" })
    );
    fireEvent.change(screen.getByLabelText("Conversation summary"), {
      target: { value: "Unsaved draft" },
    });
    context = { ...context, institutes: [] };
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["outreach"] });
    });
    await waitFor(() =>
      expect(screen.queryByDisplayValue("Unsaved draft")).toBeNull()
    );
    expect(
      screen.queryByRole("button", { name: "Save conversation" })
    ).toBeNull();
  });
  it("allows managers to filter and choose owners but keeps staff on their own scope", async () => {
    context.viewer.can_manage = true;
    show();
    await screen.findByText("Add your first institute");
    expect(screen.getByLabelText("Filter by owner")).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Add institute" }));
    const dialog = screen.getByRole("dialog", { name: "Add institute" });
    expect(within(dialog).getByLabelText("Owner")).toBeEnabled();
    fireEvent.change(within(dialog).getByLabelText("Owner"), {
      target: { value: "user-2" },
    });
    expect(within(dialog).getByLabelText("Owner")).toHaveValue("user-2");
  });
  it("keeps the save acknowledgement and history tab after the server version refreshes", async () => {
    context.institutes = [institute];
    api.recordCall.mockImplementation(async () => {
      const updated = { ...institute, updated_at: "2026-11-07T07:00:00Z" };
      context = { ...context, institutes: [updated] };
      detail = { ...detail, institute: updated, calls: [call("saved")] };
      return { call_id: "saved", institute: updated };
    });
    show();
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Open Example Business Institute/,
      })
    );
    fireEvent.click(
      await screen.findByRole("tab", { name: "Log conversation" })
    );
    fireEvent.change(screen.getByLabelText("Conversation summary"), {
      target: { value: "They will get in touch." },
    });
    fireEvent.click(screen.getByLabelText("Close without a next step"));
    fireEvent.change(screen.getByLabelText("Closure reason"), {
      target: { value: "No current requirement." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save conversation" }));
    expect(
      await screen.findByText("Conversation saved to history.")
    ).toBeInTheDocument();
    expect(await screen.findByText("Conversation saved")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(
      screen.getByText("Conversation saved to history.")
    ).toBeInTheDocument();
  });
  it.each(["2026-11-07T08:00:00Z", "2026-11-07T06:00:00.000001Z"])(
    "preserves a draft and blocks saving after background version %s until explicit reload",
    async (updatedAt) => {
      context.institutes = [institute];
      const { client } = show();
      fireEvent.click(
        await screen.findByRole("button", {
          name: /Open Example Business Institute/,
        })
      );
      fireEvent.click(
        await screen.findByRole("tab", { name: "Log conversation" })
      );
      fireEvent.change(screen.getByLabelText("Conversation summary"), {
        target: { value: "Draft to preserve" },
      });
      const updated = { ...institute, updated_at: updatedAt };
      context = { ...context, institutes: [updated] };
      await act(async () => {
        await client.invalidateQueries({ queryKey: ["outreach"] });
      });
      expect(screen.getByDisplayValue("Draft to preserve")).toBeInTheDocument();
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Save conversation" })
        ).toBeDisabled()
      );
      expect(
        screen.getByText(/This institute changed while you were drafting/)
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Reload current details" })
      );
      expect(screen.queryByDisplayValue("Draft to preserve")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Save conversation" })
      ).toBeEnabled();
    }
  );
  it("keeps a rescheduled follow-up ready for a later update after its own version refresh", async () => {
    const step = {
      id: "step-1",
      institute_id: "inst-1",
      call_id: null,
      kind: "requested_callback" as const,
      title: "Agreed office call",
      due_at: "2026-11-12T05:00:00.000Z",
      status: "open" as const,
      completion_note: "",
      created_at: institute.created_at,
      updated_at: institute.updated_at,
    };
    context.institutes = [institute];
    context.followups = [step];
    detail.followups = [step];
    api.updateFollowup.mockImplementation(async () => {
      const updated = { ...step, updated_at: "2026-11-07T09:00:00Z" };
      context = { ...context, followups: [updated] };
      detail = { ...detail, followups: [updated] };
      return updated;
    });
    show();
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Open Example Business Institute/,
      })
    );
    fireEvent.change(await screen.findByLabelText("Follow-up note"), {
      target: { value: "Coordinator requested the same time next week." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }));
    await screen.findByText("Follow-up updated.");
    await waitFor(() =>
      expect(api.fetchOutreachDetail).toHaveBeenCalledTimes(2)
    );
    expect(
      screen.queryByText(/This institute changed while you were drafting/)
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Mark complete" })).toBeEnabled();
  });
});
