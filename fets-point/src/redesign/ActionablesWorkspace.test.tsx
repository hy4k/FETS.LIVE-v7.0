import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ActionablesWorkspace } from "./MissionWorkspace";
import type { ActionablesData } from "./actionables-model";
import type { ActionablesRepository } from "./actionables-repository";
import reference from "../test/actionables-reference.json";
import { DEFAULT_STAGES } from "./institution-workflow";
vi.mock("react-hot-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
const identity = { id: "me", user_id: "me-user", full_name: "Current account" };
function fixture(): ActionablesData {
  return {
    institutions: reference.institutions.map((i) => ({
      id: i.id,
      name: i.name,
      district:
        i.district === "cochin"
          ? "Ernakulam"
          : i.district[0].toUpperCase() + i.district.slice(1),
      primary_contact_name: i.nodal,
      primary_contact_phone: i.phone,
      lab_seat_capacity: parseInt(i.capacity, 10),
      actionables_reference: i,
    })),
    stages: reference.institutions.flatMap((i) =>
      DEFAULT_STAGES.map((s, n) => ({
        ...s,
        id: i.id + "-" + s.stage_key,
        institution_id: i.id,
        position: n + 1,
        completion_note: "",
      })),
    ),
    tasks: [],
    updates: [],
    staff: [
      { ...identity, is_active: true },
      {
        id: "other",
        user_id: "other-user",
        full_name: "Other account",
        is_active: true,
      },
    ],
    selections: [],
    observations: [],
    canManage: true,
    extensionsReady: true,
    referenceTasks: reference.tasks,
  };
}
function setup(
  data = fixture(),
  overrides: Partial<ActionablesRepository> = {},
) {
  const repository: ActionablesRepository = {
    load: vi.fn().mockResolvedValue(data),
    watch: vi.fn().mockReturnValue(() => {}),
    save: vi.fn().mockResolvedValue({ id: "saved", district: "Calicut" }),
    remove: vi.fn().mockResolvedValue(undefined),
    selectTarget: vi.fn().mockResolvedValue(undefined),
    observe: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <ActionablesWorkspace profile={identity} repository={repository} />
    </QueryClientProvider>,
  );
  return { repository, user: userEvent.setup(), client };
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("Actionables staff and manager journeys", () => {
  it("adds a task from the team board with an explicit institution, owner and reporting recipient", async () => {
    const { user, repository } = setup();
    await screen.findByText("25 institutions");
    await user.click(
      screen.getByRole("button", { name: "Tasks", exact: true }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add task", exact: true }),
    );
    const dialog = screen.getByRole("dialog", { name: "Assign duty" });
    await user.selectOptions(
      within(dialog).getByLabelText("Institution"),
      "cochin-rajagiri",
    );
    await user.type(
      within(dialog).getByLabelText("Duty", { exact: true }),
      "Confirm the appointment",
    );
    await user.type(
      within(dialog).getByLabelText("Instructions / expected result"),
      "Record the date agreed with the office.",
    );
    await user.type(
      within(dialog).getByLabelText("Due date", { exact: true }),
      "2026-10-20",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Who should receive the result?"),
      "me-user",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save duty" }));
    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith(
        "mission_work_items",
        expect.objectContaining({
          institution_id: "cochin-rajagiri",
          owner_id: "me",
          report_to_id: "me-user",
          title: "Confirm the appointment",
        }),
        null,
      ),
    );
  });

  it("hides previously cached project records when access is revoked", async () => {
    const { repository, user } = setup();
    await screen.findByText("25 institutions");
    vi.mocked(repository.load).mockRejectedValue(
      new Error(
        "Project access has not been assigned to this account. Ask management to enable your access.",
      ),
    );
    await user.click(
      screen.getByRole("button", { name: "Refresh Actionables" }),
    );
    await screen.findByRole("alert");
    expect(screen.queryByText("25 institutions")).not.toBeInTheDocument();
    expect(
      screen.queryByText(reference.tasks[2].title),
    ).not.toBeInTheDocument();
  });

  it("opens on the exact institution catalogue without marketing or fabricated selection", async () => {
    const { user } = setup();
    expect(await screen.findByText("25 institutions")).toBeInTheDocument();
    expect(screen.getByText("0 / 7 selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: reference.institutions[0].name,
        exact: true,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Big goals.")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Overview", exact: true }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Tasks", exact: true }),
    );
    expect(screen.getByText(reference.tasks[2].title)).toBeInTheDocument();
    expect(screen.getByText("Completed in project brief")).toBeInTheDocument();
  });
  it("shows staff only their own work, including completed work with a pending follow-up", async () => {
    const data = fixture();
    data.tasks = [
      {
        id: "mine",
        title: "My next conversation",
        owner_id: "me",
        institution_id: "cochin-rajagiri",
        status: "done",
      },
      {
        id: "theirs",
        title: "Someone else’s assignment",
        owner_id: "other",
        status: "open",
      },
    ];
    data.updates = [
      {
        id: "result",
        work_item_id: "mine",
        status: "done",
        content: "Visit agreed",
        reported: true,
        created_at: "2026-01-01T00:00:00Z",
        follow_up_date: "2000-01-01",
      },
    ];
    const { user } = setup(data);
    await screen.findByText("25 institutions");
    await user.click(
      screen.getByRole("button", { name: "Tasks", exact: true }),
    );
    await user.selectOptions(screen.getByLabelText("Filter owner"), "me");
    expect(await screen.findByText("My next conversation")).toBeInTheDocument();
    expect(
      screen.queryByText("Someone else’s assignment"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Follow-up due")).toBeInTheDocument();
  });
  it("does not show success or discard a result draft when saving fails", async () => {
    const data = fixture();
    data.tasks = [
      {
        id: "mine",
        title: "Call the principal",
        owner_id: "me",
        institution_id: "cochin-rajagiri",
        status: "open",
      },
    ];
    const { user, repository } = setup(data, {
      save: vi.fn().mockRejectedValue(new Error("Connection interrupted")),
    });
    await screen.findByText("25 institutions");
    await user.click(
      screen.getByRole("button", { name: "Tasks", exact: true }),
    );
    await user.click(
      screen.getByRole("button", { name: "Update result", exact: true }),
    );
    const dialog = screen.getByRole("dialog", { name: "Update result" });
    const text = within(dialog).getByLabelText("Result / what happened");
    await user.type(text, "The principal asked for a follow-up call.");
    await user.click(
      within(dialog).getByRole("button", { name: "Save result" }),
    );
    await waitFor(() => expect(repository.save).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith("Connection interrupted");
    expect(toast.success).not.toHaveBeenCalled();
    expect(text).toHaveValue("The principal asked for a follow-up call.");
    expect(dialog).toBeInTheDocument();
  });
  it("keeps source percentages separate from new item-level observations", async () => {
    const { user } = setup();
    await screen.findByText("25 institutions");
    await user.click(
      screen.getByRole("button", { name: "Institutions", exact: true }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Blastline Institute of Technology",
        exact: true,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Readiness & evidence", exact: true }),
    );
    expect(await screen.findAllByText("No observation yet")).toHaveLength(10);
    expect(screen.getByText("details to record")).toBeInTheDocument();
    expect(screen.queryByText("Pearson VUE Ready")).not.toBeInTheDocument();
  });
  it("disables shortlist decisions for staff while leaving observation recording available", async () => {
    const data = fixture();
    data.canManage = false;
    const { user } = setup(data);
    await screen.findByText("25 institutions");
    await user.click(
      screen.getByRole("button", { name: "Institutions", exact: true }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Rajagiri College of Social Sciences",
        exact: true,
      }),
    );
    expect(
      screen.getByRole("button", { name: "Add to shortlist" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Readiness & evidence" }),
    );
    expect(
      screen.getAllByRole("button", { name: "Record observation" })[0],
    ).toBeEnabled();
  });
  it("focuses the first field and restores focus when Escape closes a dialog", async () => {
    const { user } = setup();
    await screen.findByText("25 institutions");
    const button = screen.getByRole("button", {
      name: "Add institution",
      exact: true,
    });
    await user.click(button);
    expect(screen.getByLabelText("Institution name")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
  it("does not render zero-valued summaries as loaded facts when loading fails", async () => {
    setup(fixture(), {
      load: vi.fn().mockRejectedValue(new Error("No access")),
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load the workspace",
    );
    expect(screen.queryByText("25 institutions")).not.toBeInTheDocument();
    expect(screen.queryByText("No flagged duties")).not.toBeInTheDocument();
  });
});
