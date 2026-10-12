import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShiftWorkplace } from "./DutyWorkspace";
import { centreDate } from "./operations-data";
import { createDayPlan } from "./shift-plan";
const team = ["a", "b", "c"].map((id) => ({
  id,
  userId: id,
  name: `Colleague ${id.toUpperCase()}`,
  code: "D",
}));
const responsibility = {
  id: "r1",
  branch: "cochin",
  area: "exam",
  title: "Prepare lab",
  details: "Use the readiness checklist",
  expected_result: "Every station passes the readiness check",
  due_minute: 600,
  priority: "important",
  frequency: "daily",
  weekday: null,
  monthday: null,
  owner_id: "b",
  backup_id: "c",
  position: 0,
  active: true,
};
const task = {
  id: "t1",
  branch: "cochin",
  day: centreDate(),
  responsibility_id: "r1",
  title: "Prepare lab",
  assigned_to: "b",
  status: "open",
  note: "",
  done_by: null,
  done_at: null,
  verified_by: null,
  verified_at: null,
  version: 1,
  expected_result: responsibility.expected_result,
  instructions: responsibility.details,
  due_minute: 600,
  priority: "important",
  completion_note: "",
  rework_count: 0,
};
function mocks() {
  const repository = {
    roster: vi.fn().mockResolvedValue(team),
    load: vi.fn().mockResolvedValue({
      record: null,
      lead: { lead_id: "a" },
      events: [],
      changes: [],
      closed: false,
    }),
    monthRoster: vi.fn(),
    leads: vi.fn(),
    saveLead: vi.fn(),
    savePlan: vi.fn(),
    event: vi.fn(),
    reports: vi.fn().mockResolvedValue([]),
    report: vi.fn(),
    change: vi.fn(),
    acknowledge: vi.fn(),
  };
  const blueprint = {
    staff: vi.fn().mockResolvedValue(team),
    responsibilities: vi.fn().mockResolvedValue([
      responsibility,
      {
        ...responsibility,
        id: "r2",
        title: "Order stationery",
        owner_id: "a",
        backup_id: null,
      },
    ]),
    tasks: vi.fn().mockResolvedValue([task]),
    actionables: vi.fn().mockResolvedValue([]),
    saveResponsibility: vi.fn(),
    removeResponsibility: vi.fn(),
    seed: vi.fn(),
    setTask: vi.fn(),
    carry: vi.fn(),
    removeTask: vi.fn(),
    verifyTask: vi.fn(),
  };
  const work = {
    access: vi.fn().mockResolvedValue({ lead: false, manager: false }),
    ensure: vi.fn().mockImplementation((i) => Promise.resolve(i.task || task)),
    action: vi.fn().mockImplementation((t, action, note) =>
      Promise.resolve({
        ...t,
        version: t.version + 1,
        status: action === "complete" ? "done" : "open",
        completion_note: note,
        done_by: action === "complete" ? "b" : null,
      }),
    ),
    assign: vi.fn(),
    add: vi.fn(),
    history: vi.fn().mockResolvedValue([task]),
    notes: vi.fn().mockResolvedValue([]),
    saveNote: vi.fn(),
    respond: vi.fn(),
    closeNote: vi.fn(),
    activity: vi.fn().mockResolvedValue([]),
  };
  return { repository, blueprint, work };
}
function mount(
  m = mocks(),
  id = "b",
  admin = false,
  ready = true,
  branch = "cochin",
) {
  render(
    <ShiftWorkplace
      branch={branch}
      navigate={vi.fn()}
      identity={{
        id,
        profileId: id,
        name: `Colleague ${id.toUpperCase()}`,
        admin,
      }}
      {...(m as any)}
      workflowReady={ready}
    />,
  );
  return m;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("outcome duty workplace", () => {
  it("starts staff with their own agreement and puts planning in a separate destination", async () => {
    mount();
    const list = await screen.findByRole("region", { name: "My duties" });
    expect(within(list).getByText("Prepare lab")).toBeInTheDocument();
    expect(
      within(list).queryByText("Order stationery"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(responsibility.expected_result),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Who is here, and when?"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Plan & responsibilities" }),
    ).not.toBeInTheDocument();
  });
  it("requires a result and sends it for independent review with the current version", async () => {
    const m = mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit result" }),
    );
    expect(
      screen.getByRole("button", { name: "Send for independent review" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("What result did you achieve?"), {
      target: { value: "Checked every station and replaced one headset" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send for independent review" }),
    );
    await waitFor(() =>
      expect(m.work.action).toHaveBeenCalledWith(
        task,
        "complete",
        "Checked every station and replaced one headset",
        "",
      ),
    );
    expect(
      await screen.findByText(
        "Result submitted. An independent reviewer will check it.",
      ),
    ).toBeInTheDocument();
  });
  it("keeps written evidence on save failure and never announces success", async () => {
    const m = mocks();
    m.work.action.mockRejectedValue(new Error("Connection lost"));
    mount(m);
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit result" }),
    );
    fireEvent.change(screen.getByLabelText("What result did you achieve?"), {
      target: { value: "All stations checked" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send for independent review" }),
    );
    await screen.findByRole("alert");
    expect(screen.getByLabelText("What result did you achieve?")).toHaveValue(
      "All stations checked",
    );
    expect(
      screen.queryByText(
        "Result submitted. An independent reviewer will check it.",
      ),
    ).not.toBeInTheDocument();
  });
  it("asks for the kind of support and a specific explanation", async () => {
    const m = mount();
    fireEvent.click(await screen.findByRole("button", { name: "I need help" }));
    fireEvent.change(
      screen.getByLabelText("What is stopping you, and what would help?"),
      { target: { value: "Need a spare headset" } },
    );
    expect(
      screen.getByRole("button", { name: "Ask the lead for help" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Help needed"), {
      target: { value: "equipment" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ask the lead for help" }),
    );
    await waitFor(() =>
      expect(m.work.action).toHaveBeenCalledWith(
        task,
        "help",
        "Need a spare headset",
        "equipment",
      ),
    );
  });
  it("gives an independent lead review actions and hides completion actions for others", async () => {
    const m = mocks();
    m.blueprint.tasks.mockResolvedValue([
      {
        ...task,
        status: "done",
        done_by: "b",
        completion_note: "Checked",
        done_at: new Date().toISOString(),
      },
    ]);
    m.work.access.mockResolvedValue({ lead: true, manager: false });
    mount(m, "a");
    fireEvent.click(await screen.findByRole("button", { name: "Team day" }));
    fireEvent.click(await screen.findByRole("button", { name: /Prepare lab/ }));
    expect(
      screen.getByRole("button", { name: "Verify result" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Return with feedback" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit result" }),
    ).not.toBeInTheDocument();
  });
  it("lets the lead agree a result on existing open work without silently rewriting history", async () => {
    const m = mocks();
    m.work.access.mockResolvedValue({ lead: true, manager: false });
    m.work.assign.mockImplementation(
      async (t, owner, due, priority, result, instructions) => {
        const saved = {
          ...t,
          assigned_to: owner,
          due_minute: due,
          priority,
          expected_result: result,
          instructions,
          version: 2,
        };
        m.blueprint.tasks.mockResolvedValue([saved]);
        return saved;
      },
    );
    mount(m, "a");
    fireEvent.click(await screen.findByRole("button", { name: "Team day" }));
    fireEvent.click(await screen.findByRole("button", { name: /Prepare lab/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Edit work agreement" }),
    );
    fireEvent.change(screen.getByLabelText("Done means"), {
      target: { value: "All stations and spares pass inspection" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save agreement" }));
    await waitFor(() =>
      expect(m.work.assign).toHaveBeenCalledWith(
        task,
        "b",
        600,
        "important",
        "All stations and spares pass inspection",
        responsibility.details,
      ),
    );
    expect(await screen.findByText("Assignment agreed.")).toBeInTheDocument();
  });
  it("keeps the lead from verifying their own completed job", async () => {
    const m = mocks();
    m.blueprint.tasks.mockResolvedValue([
      { ...task, status: "done", assigned_to: "a", done_by: "a" },
    ]);
    m.work.access.mockResolvedValue({ lead: true, manager: false });
    mount(m, "a");
    fireEvent.click(await screen.findByRole("button", { name: /Prepare lab/ }));
    await screen.findByText("Submitted. Someone else must verify your work.");
    expect(
      screen.queryByRole("button", { name: "Verify result" }),
    ).not.toBeInTheDocument();
  });
  it("shows historical duties but disables new actions until the server is activated", async () => {
    mount(mocks(), "b", false, false);
    await screen.findByText(responsibility.expected_result);
    expect(
      screen.getByRole("button", { name: "Submit result" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "I need help" })).toBeDisabled();
  });
  it("does not load a global centre as if it were a real roster", async () => {
    const m = mount(mocks(), "b", false, true, "global");
    expect(
      await screen.findByText("Start with one centre."),
    ).toBeInTheDocument();
    expect(m.repository.roster).not.toHaveBeenCalled();
  });
  it("records the due DVR check for the named break cover", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T04:37:00Z"));
    const m = mocks();
    const plan = createDayPlan(team);
    plan.breaks.find((b) => b.staff === "a" && b.start === 600)!.cover = "b";
    m.repository.load.mockResolvedValue({
      record: { id: "plan", plan, status: "published" },
      lead: { lead_id: "a" },
      events: [],
      changes: [],
      closed: false,
    } as any);
    m.repository.event.mockResolvedValue({
      id: "e",
      block: 1,
      lane: "control",
      kind: "dvr",
      due: 606,
    });
    mount(m);
    fireEvent.click(
      await screen.findByRole("button", { name: "Record DVR at 10:06" }),
    );
    await waitFor(() =>
      expect(m.repository.event).toHaveBeenCalledWith({
        plan_id: "plan",
        block: 1,
        lane: "control",
        kind: "dvr",
        due: 606,
        note: "",
      }),
    );
  });
  it("shows a failed management read as an error instead of zero performance", async () => {
    const m = mocks();
    m.work.access.mockResolvedValue({ lead: true, manager: true });
    m.work.history.mockRejectedValue(new Error("History unavailable"));
    mount(m, "a", true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Review & development" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "History unavailable",
    );
    expect(screen.queryByText("assignments verified")).not.toBeInTheDocument();
  });
  it("requires the actual follow-up outcome before management closes a decision", async () => {
    const m = mocks();
    m.work.access.mockResolvedValue({ lead: true, manager: true });
    const n: any = {
      id: "note",
      branch: "cochin",
      profile_id: "a",
      kind: "training",
      evidence: "Observed work",
      context: "New to the role",
      action: "Practise with lead",
      review_on: centreDate(),
      status: "open",
      staff_response: "",
      evidence_snapshot: [],
    };
    m.work.notes.mockResolvedValue([n]);
    m.work.closeNote.mockResolvedValue({
      ...n,
      status: "closed",
      followup_result: "Practised the checklist independently",
    });
    mount(m, "a", true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Review & development" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Record follow-up outcome" }),
    );
    expect(
      screen.getByRole("button", { name: "Record outcome & close follow-up" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Follow-up outcome"), {
      target: { value: "Practised the checklist independently" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Record outcome & close follow-up" }),
    );
    await waitFor(() =>
      expect(m.work.closeNote).toHaveBeenCalledWith(
        "note",
        "Practised the checklist independently",
      ),
    );
    expect(await screen.findByText("Follow-up closed")).toBeInTheDocument();
  });
  it("requires context and human review before recording a warning", async () => {
    const m = mocks();
    m.work.access.mockResolvedValue({ lead: true, manager: true });
    mount(m, "a", true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Review & development" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Agree feedback & a next step",
      }),
    );
    fireEvent.change(screen.getByLabelText("Next step"), {
      target: { value: "warning" },
    });
    fireEvent.change(screen.getByLabelText("Observed work & evidence"), {
      target: { value: "Specific observed result" },
    });
    fireEvent.change(
      screen.getByLabelText("Agreed action, support or recognition"),
      { target: { value: "Training with the lead" } },
    );
    fireEvent.change(screen.getByLabelText("Follow up on"), {
      target: { value: "2026-10-15" },
    });
    expect(
      screen.getByRole("button", { name: "Save feedback & follow-up" }),
    ).toBeDisabled();
    expect(m.work.saveNote).not.toHaveBeenCalled();
  });
});
