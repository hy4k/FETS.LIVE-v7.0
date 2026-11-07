import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BatchEditor,
  CallEditor,
  InstituteEditor,
  FollowupEditor,
  OutreachDialog,
} from "./PrometricForms";
import type {
  OutreachContext,
  OutreachFollowup,
  OutreachInstitute,
} from "./types";

const service = vi.hoisted(() => ({
  saveInstitute: vi.fn(),
  recordCall: vi.fn(),
  saveBatch: vi.fn(),
  updateFollowup: vi.fn(),
}));
vi.mock("./api", () => service);
const institute: OutreachInstitute = {
  id: "inst-1",
  name: "Example Business Institute",
  city: "Kochi",
  state: "Kerala",
  contact_name: "Office contact",
  contact_role: "Coordinator",
  phone: "12345",
  email: "",
  website: "",
  preferred_centre: "cochin",
  owner_user_id: "user-1",
  stage: "interested",
  contact_permission: "allowed",
  interest: "centre_mock",
  notes: "",
  last_contact_at: null,
  created_at: "2026-11-01T06:00:00Z",
  updated_at: "2026-11-07T06:00:00Z",
};
const context: OutreachContext = {
  viewer: { user_id: "user-1", can_manage: false },
  staff: [
    { user_id: "user-1", full_name: "Current staff" },
    { user_id: "user-2", full_name: "Other staff" },
  ],
  institutes: [institute],
  followups: [],
  batches: [],
};
function show(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  );
  return { ...view, invalidate };
}
beforeEach(() => {
  Object.values(service).forEach((fn) => fn.mockReset().mockResolvedValue({}));
});

describe("Prometric guided forms", () => {
  it("opens a dialog at the beginning of its content while focusing its close control", () => {
    show(
      <OutreachDialog title="Long call guide" onClose={() => {}}>
        <div
          ref={(node) => {
            const dialog = node?.closest<HTMLElement>('[role="dialog"]');
            if (dialog) dialog.scrollTop = 300;
          }}
        >
          Conversation guide content
        </div>
      </OutreachDialog>
    );
    expect(screen.getByRole("dialog").scrollTop).toBe(0);
    expect(
      screen.getByRole("button", { name: "Close Long call guide" })
    ).toHaveFocus();
  });
  it("requires a business phone or email and assigns a staff-created institute to its viewer", async () => {
    show(<InstituteEditor context={context} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText("Institute name"), {
      target: { value: "A new institute" },
    });
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Kochi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save institute" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "business phone or email"
    );
    expect(service.saveInstitute).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Owner")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Business email"), {
      target: { value: "office@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save institute" }));
    await waitFor(() =>
      expect(service.saveInstitute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: null,
          owner_user_id: "user-1",
          email: "office@example.test",
        })
      )
    );
  });
  it("requires a dated next step or an explicit closure for each conversation", async () => {
    show(<CallEditor institute={institute} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText("Conversation summary"), {
      target: { value: "Discussed readiness support." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save conversation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "next step date and time"
    );
    expect(service.recordCall).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Next step date (IST)"), {
      target: { value: "2026-11-12" },
    });
    fireEvent.change(screen.getByLabelText("Next step time (IST)"), {
      target: { value: "10:30" },
    });
    fireEvent.change(screen.getByLabelText("Next step"), {
      target: { value: "Discuss a centre visit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save conversation" }));
    await waitFor(() =>
      expect(service.recordCall).toHaveBeenCalledWith(
        expect.objectContaining({
          institute_id: "inst-1",
          expected_updated_at: institute.updated_at,
          next_step: {
            kind: "requested_callback",
            title: "Discuss a centre visit",
            due_at: "2026-11-12T05:00:00.000Z",
          },
        })
      )
    );
  });
  it("retries an unchanged call with the same request id and prevents double submission", async () => {
    service.recordCall
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce({});
    const { invalidate } = show(
      <CallEditor institute={institute} onSaved={() => {}} />
    );
    fireEvent.change(screen.getByLabelText("Conversation summary"), {
      target: { value: "No further follow-up needed." },
    });
    fireEvent.click(screen.getByLabelText("Close without a next step"));
    fireEvent.change(screen.getByLabelText("Closure reason"), {
      target: { value: "They will contact us if interested." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save conversation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection lost"
    );
    fireEvent.click(screen.getByRole("button", { name: "Save conversation" }));
    await waitFor(() => expect(service.recordCall).toHaveBeenCalledTimes(2));
    expect(service.recordCall.mock.calls[1][0]).toEqual(
      service.recordCall.mock.calls[0][0]
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["outreach"] })
    );
  });
  it("stops outbound call logging for a do-not-contact institute but allows an inbound permission update", () => {
    show(
      <CallEditor
        institute={{ ...institute, contact_permission: "do_not_contact" }}
        onSaved={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: "Save conversation" })
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Outbound contact is stopped"
    );
    fireEvent.change(screen.getByLabelText("Channel"), {
      target: { value: "inbound" },
    });
    fireEvent.change(screen.getByLabelText("Outcome"), {
      target: { value: "permission_update" },
    });
    expect(
      screen.getByRole("button", { name: "Save conversation" })
    ).toBeEnabled();
  });
  it("allows an internal correction while do-not-contact permission stays stopped", async () => {
    show(
      <CallEditor
        institute={{ ...institute, contact_permission: "do_not_contact" }}
        onSaved={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText("Channel"), {
      target: { value: "note" },
    });
    expect(
      screen.getByRole("button", { name: "Save conversation" })
    ).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Permission for follow-up"), {
      target: { value: "allowed" },
    });
    expect(
      screen.getByRole("button", { name: "Save conversation" })
    ).toBeDisabled();
  });
  it("explains why an active relationship without a next step remains flagged", () => {
    show(<CallEditor institute={institute} onSaved={() => {}} />);
    fireEvent.click(screen.getByLabelText("Close without a next step"));
    expect(
      screen.getByText(/It will appear in Needs next step/)
    ).toBeInTheDocument();
  });
  it("validates batch counts before saving a distinct pipeline record", async () => {
    show(<BatchEditor institute={institute} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText("Batch name"), {
      target: { value: "November cohort" },
    });
    fireEvent.change(screen.getByLabelText("Batch status"), {
      target: { value: "completed" },
    });
    fireEvent.change(screen.getByLabelText("Confirmed candidates"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Attended candidates"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save batch" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Attendance cannot exceed confirmed"
    );
    expect(service.saveBatch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Attended candidates"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save batch" }));
    await waitFor(() =>
      expect(service.saveBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          delivery: "fets_centre",
          confirmed: 4,
          attended: 3,
          institute_id: "inst-1",
        })
      )
    );
  });
  it("invalidates after a late successful save without updating the departed form", async () => {
    let finish!: (value: unknown) => void;
    service.saveBatch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const saved = vi.fn();
    const { unmount, invalidate } = show(
      <BatchEditor institute={institute} onSaved={saved} />
    );
    fireEvent.change(screen.getByLabelText("Batch name"), {
      target: { value: "November cohort" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save batch" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
    expect(service.saveBatch).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => finish({}));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["outreach"] });
    expect(saved).not.toHaveBeenCalled();
  });
  it("sends the follow-up version and requires a completion note", async () => {
    const followup: OutreachFollowup = {
      id: "step-1",
      institute_id: "inst-1",
      call_id: null,
      kind: "requested_callback",
      title: "Call office",
      due_at: "2026-11-12T05:00:00Z",
      status: "open",
      completion_note: "",
      created_at: institute.created_at,
      updated_at: institute.updated_at,
    };
    show(<FollowupEditor followup={followup} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Add a note");
    fireEvent.change(screen.getByLabelText("Follow-up note"), {
      target: { value: "Office confirmed the discussion." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));
    await waitFor(() =>
      expect(service.updateFollowup).toHaveBeenCalledWith({
        id: "step-1",
        expected_updated_at: institute.updated_at,
        status: "done",
        due_at: followup.due_at,
        note: "Office confirmed the discussion.",
      })
    );
  });
  it("keeps an internal review actionable when outbound contact is stopped", () => {
    const followup: OutreachFollowup = {
      id: "step-1",
      institute_id: "inst-1",
      call_id: null,
      kind: "internal_review",
      title: "Review requirements internally",
      due_at: "2026-11-12T05:00:00Z",
      status: "open",
      completion_note: "",
      created_at: institute.created_at,
      updated_at: institute.updated_at,
    };
    show(<FollowupEditor followup={followup} stopped onSaved={() => {}} />);
    expect(screen.getByRole("button", { name: "Mark complete" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeEnabled();
  });
});
