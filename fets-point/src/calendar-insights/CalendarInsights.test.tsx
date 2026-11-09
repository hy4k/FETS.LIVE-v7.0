import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarAnalysis } from "../components/CalendarAnalysis";
import type { SeatContext, SeatSession } from "../seats/types";

const boundary = vi.hoisted(() => ({
  user: { id: "analytics-user-a" } as { id: string } | null,
  calendar: vi.fn(),
  context: vi.fn(),
}));
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: boundary.user, loading: false }),
}));
vi.mock("../seats/calendar-data", () => ({
  fetchCalendarRange: boundary.calendar,
}));
vi.mock("../seats/planning-range", () => ({
  fetchSeatPlanningRange: boundary.context,
}));

const context: SeatContext = {
  rules: [],
  details: [],
  adjacent_sessions: [],
  capacity_adjustments: [],
  can_edit_rules: false,
};
const sessions: SeatSession[] = [
  {
    id: 1,
    date: "2027-02-14",
    branch_location: "cochin",
    client_name: "PEARSON VUE",
    exam_name: "Alpha",
    candidate_count: 20,
    start_time: "10:00",
    end_time: "11:00",
    status: "scheduled",
  },
  {
    id: 2,
    date: "2027-02-14",
    branch_location: "cochin",
    client_name: "PROMETRIC",
    exam_name: "Beta",
    candidate_count: 15,
    start_time: "10:30",
    end_time: "11:30",
    status: "scheduled",
  },
  {
    id: 3,
    date: "2027-02-16",
    branch_location: "cochin",
    client_name: "ITTS",
    exam_name: "Pearson named independent exam",
    candidate_count: 2,
    start_time: "14:00",
    end_time: "15:00",
    status: "scheduled",
  },
];
const previous: SeatSession[] = [
  { ...sessions[0], id: 4, date: "2027-01-14", candidate_count: 10 },
];
const clients: QueryClient[] = [];
function show(
  overrides: Partial<React.ComponentProps<typeof CalendarAnalysis>> = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  const props = {
    activeBranch: "cochin",
    initialMonth: "2027-02",
    onClose: vi.fn(),
    onOpenSeatManagement: vi.fn(),
    onOpenCalendarDate: vi.fn(),
    ...overrides,
  };
  const view = render(
    <QueryClientProvider client={client}>
      <CalendarAnalysis {...props} />
    </QueryClientProvider>
  );
  return {
    ...view,
    props,
    client,
    rerenderInsights: (next: Partial<typeof props> = {}) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <CalendarAnalysis {...props} {...next} />
        </QueryClientProvider>
      ),
  };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
  boundary.user = { id: "analytics-user-a" };
  boundary.calendar
    .mockReset()
    .mockImplementation(async (_from: string, through: string) =>
      through === "2027-02-28" ? sessions : previous
    );
  boundary.context.mockReset().mockResolvedValue(context);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Calendar analytics with real accounting and scoped reads", () => {
  it("starts at the Calendar month and exposes actual volume, provider identity and every daily value", async () => {
    show();
    expect(
      await screen.findByRole("group", { name: "Scheduled candidates" })
    ).toHaveTextContent("37");
    expect(
      screen.getByRole("heading", { name: "February 2027" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Exam sessions" })
    ).toHaveTextContent("3");
    expect(
      screen.getByRole("group", { name: "Booked days" })
    ).toHaveTextContent("2");
    expect(
      screen.getByRole("group", { name: "Upcoming candidates" })
    ).toHaveTextContent("37");
    expect(
      within(screen.getByRole("region", { name: "Provider mix" })).getByText(
        "ITTS"
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/270%/)).toBeInTheDocument();
    const daily = screen.getByRole("region", { name: "Daily demand" });
    expect(within(daily).getAllByRole("button")).toHaveLength(28);
    expect(
      within(daily).getByRole("button", {
        name: "1 February 2027: 0 scheduled candidates, 0 sessions",
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /utilisation|revenue|attendance rate|efficiency score/i
      )
    ).not.toBeInTheDocument();
  });

  it("opens exact attention windows in Seat management and daily demand in Calendar", async () => {
    const view = show();
    const attention = await screen.findByRole("region", {
      name: "Needs attention",
    });
    expect(attention).toHaveTextContent("35 / 31");
    expect(attention).toHaveTextContent("10:30–11:00");
    fireEvent.click(
      within(attention).getByRole("button", {
        name: /Review Kochi.*14 February 2027.*10:30/,
      })
    );
    expect(view.props.onOpenSeatManagement).toHaveBeenCalledWith("2027-02-14");
    fireEvent.click(
      screen.getByRole("button", {
        name: "16 February 2027: 2 scheduled candidates, 1 session",
      })
    );
    expect(view.props.onOpenCalendarDate).toHaveBeenCalledWith("2027-02-16");
  });

  it("retains current volume when prior or seat reads fail without making a safety claim", async () => {
    boundary.calendar.mockImplementation(
      async (_from: string, through: string) => {
        if (through !== "2027-02-28") throw new Error("Prior read unavailable");
        return sessions;
      }
    );
    boundary.context.mockRejectedValue(new Error("Seat read unavailable"));
    show();
    expect(
      await screen.findByRole("group", { name: "Scheduled candidates" })
    ).toHaveTextContent("37");
    expect(screen.getByText(/Comparison unavailable/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Seat verification unavailable/).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(/No known full or overbooked windows/)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/270%/)).not.toBeInTheDocument();
  });

  it("shows current-read failure as unavailable rather than zero", async () => {
    boundary.calendar.mockRejectedValue(new Error("Calendar read unavailable"));
    show();
    expect(
      await screen.findByRole("alert", {}, { timeout: 2500 })
    ).toHaveTextContent(/Calendar.*unavailable|Unable to load/i);
    expect(
      screen.queryByRole("group", { name: "Scheduled candidates" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  });

  it("keeps known volume while refreshing, blocks stale export and invalidates the connected Calendar reads", async () => {
    const view = show();
    await screen.findByRole("group", { name: "Scheduled candidates" });
    const invalidation = vi.spyOn(view.client, "invalidateQueries");
    let finish!: (value: SeatSession[]) => void;
    boundary.calendar.mockImplementation((_from: string, through: string) =>
      through === "2027-02-28"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(previous)
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Download CSV" })
      ).toBeDisabled()
    );
    expect(
      screen.getByRole("group", { name: "Scheduled candidates" })
    ).toHaveTextContent("37");
    expect(
      screen.getByText(/Refreshing bookings and seat checks/)
    ).toBeInTheDocument();
    expect(invalidation).toHaveBeenCalledWith({
      queryKey: ["sessions", "calendar"],
    });
    expect(invalidation).toHaveBeenCalledWith({ queryKey: ["seat-context"] });
    expect(invalidation).toHaveBeenCalledWith({
      queryKey: ["calendar-insights"],
    });
    await act(async () => finish(sessions));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download CSV" })).toBeEnabled()
    );
  });

  it("rejects reversed and over-twelve-month ranges and supports the full twelve-month boundary", async () => {
    show();
    await screen.findByRole("group", { name: "Scheduled candidates" });
    fireEvent.change(screen.getByLabelText("Report period"), {
      target: { value: "range" },
    });
    fireEvent.change(screen.getByLabelText("From month"), {
      target: { value: "2027-02" },
    });
    fireEvent.change(screen.getByLabelText("Through month"), {
      target: { value: "2028-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply period" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/12|twelve/);
    expect(
      screen.getByRole("heading", { name: "February 2027" })
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Through month"), {
      target: { value: "2027-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply period" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /before|after|start|range/i
    );
    fireEvent.change(screen.getByLabelText("Through month"), {
      target: { value: "2028-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply period" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
    expect(await screen.findByText(/Weekly totals/)).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Daily booking values" })
    ).toBeInTheDocument();
  });

  it("clears private volume immediately on branch or identity changes and ignores late responses", async () => {
    const view = show();
    await screen.findByRole("group", { name: "Scheduled candidates" });
    let finishOld!: (rows: SeatSession[]) => void;
    boundary.calendar.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        })
    );
    view.rerenderInsights({ activeBranch: "calicut" });
    expect(
      screen.queryByRole("group", { name: "Scheduled candidates" })
    ).not.toBeInTheDocument();
    boundary.user = { id: "analytics-user-b" };
    boundary.calendar.mockImplementation(() => new Promise(() => {}));
    view.rerenderInsights({ activeBranch: "calicut" });
    await act(async () =>
      finishOld([
        { ...sessions[0], branch_location: "calicut", candidate_count: 999 },
      ])
    );
    expect(
      screen.queryByRole("group", { name: "Scheduled candidates" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  });

  it("exports actual selected-period rows with cancelled records excluded and formula text neutralised", async () => {
    const exportRows = [
      ...sessions,
      {
        ...sessions[0],
        id: 91,
        client_name: "=SUM(1,2)",
        exam_name: 'A "quoted" exam',
      },
      {
        ...sessions[0],
        id: 92,
        exam_name: "Cancelled sentinel",
        status: "cancelled",
      },
    ];
    boundary.calendar.mockImplementation(
      async (_from: string, through: string) =>
        through === "2027-02-28" ? exportRows : previous
    );
    let downloaded: Blob | undefined;
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL(blob: Blob) {
          downloaded = blob;
          return "blob:calendar-download";
        }
        static revokeObjectURL() {}
      }
    );
    let filename = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function () {
        filename = this.download;
      }
    );
    show();
    await screen.findByRole("group", { name: "Scheduled candidates" });
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(filename).toBe(
      "calendar-bookings-cochin-2027-02-01-to-2027-02-28.csv"
    );
    expect(downloaded).toBeInstanceOf(Blob);
    const csv = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(downloaded!);
    });
    expect(csv).toContain(
      '"2027-02-14","cochin","PEARSON VUE","Alpha","20","10:00","11:00"'
    );
    expect(csv).toContain('"\'=SUM(1,2)"');
    expect(csv).toContain('"A ""quoted"" exam"');
    expect(csv).not.toContain("Cancelled sentinel");
    expect(csv).not.toContain("2027-01-14");
    vi.unstubAllGlobals();
  });

  it("qualifies incomplete volume and keeps known overbooked windows alongside missing details", async () => {
    boundary.calendar.mockImplementation(
      async (_from: string, through: string) =>
        through === "2027-02-28"
          ? [
              ...sessions,
              { ...sessions[0], id: 90, candidate_count: -2, start_time: null },
            ]
          : previous
    );
    show();
    expect(
      await screen.findByRole("group", { name: "Scheduled candidates" })
    ).toHaveTextContent("37");
    expect(screen.getByText(/Known booking totals only/)).toBeInTheDocument();
    expect(
      screen.getByText(/Comparison unavailable for incomplete/)
    ).toBeInTheDocument();
    const attention = screen.getByRole("region", { name: "Needs attention" });
    expect(attention).toHaveTextContent("Overbooked");
    expect(attention).toHaveTextContent("35 / 31");
    expect(attention).toHaveTextContent("Details incomplete");
    expect(
      screen.queryByText(/No known full or overbooked windows/)
    ).not.toBeInTheDocument();
  });

  it("gives a textual zero-baseline comparison and handles an empty period without implying free seats", async () => {
    boundary.calendar.mockImplementation(
      async (_from: string, through: string) =>
        through === "2027-02-28" ? sessions : []
    );
    const view = show();
    await screen.findByRole("group", { name: "Scheduled candidates" });
    expect(
      screen.getByText(
        /No scheduled candidates in January 2027; 37 in this period/
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Infinity|NaN|100%/)).not.toBeInTheDocument();
    boundary.calendar.mockResolvedValue([]);
    await act(async () => {
      await view.client.invalidateQueries({ queryKey: ["calendar-insights"] });
    });
    await waitFor(() =>
      expect(
        screen.getByRole("group", { name: "Scheduled candidates" })
      ).toHaveTextContent("0")
    );
    expect(
      screen.getByText("No bookings recorded in this period.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Blank days do not establish seat availability/)
    ).toBeInTheDocument();
  });

  it("removes a clean seat conclusion during refresh and after a failed refresh while keeping loaded volume", async () => {
    boundary.calendar.mockImplementation(
      async (_from: string, through: string) =>
        through === "2027-02-28" ? [sessions[2]] : previous
    );
    const view = show();
    await screen.findByText("No known full or overbooked windows.");
    let fail!: (reason: Error) => void;
    boundary.calendar.mockImplementation((_from: string, through: string) =>
      through === "2027-02-28"
        ? new Promise((_resolve, reject) => {
            fail = reject;
          })
        : Promise.resolve(previous)
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    expect(
      screen.queryByText("No known full or overbooked windows.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeDisabled();
    boundary.calendar.mockRejectedValue(new Error("Refresh unavailable"));
    await act(async () => fail(new Error("Refresh unavailable")));
    await screen.findByRole("alert", {}, { timeout: 2500 });
    expect(
      screen.getByRole("group", { name: "Scheduled candidates" })
    ).toHaveTextContent("2");
    expect(
      screen.queryByText("No known full or overbooked windows.")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeDisabled();
    view.unmount();
  });

  it("recalculates upcoming volume at India midnight even when the loaded bookings are unchanged", async () => {
    vi.setSystemTime(new Date("2027-02-14T18:29:00Z"));
    const view = show();
    expect(
      await screen.findByRole("group", { name: "Upcoming candidates" })
    ).toHaveTextContent("37");
    vi.setSystemTime(new Date("2027-02-14T18:31:00Z"));
    view.rerenderInsights();
    expect(
      screen.getByRole("group", { name: "Upcoming candidates" })
    ).toHaveTextContent("2");
  });

  it("portals outside transformed Calendar, traps focus, closes on Escape and restores the opener", async () => {
    const previousClasses = document.documentElement.className;
    document.documentElement.classList.add("existing-shell-class");
    const expectedClasses = document.documentElement.className;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "scroll";
    const opener = document.createElement("button");
    opener.textContent = "Analytics opener";
    document.body.appendChild(opener);
    opener.focus();
    const view = show();
    const dialog = screen.getByRole("dialog", { name: "Calendar analytics" });
    expect(dialog.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe("hidden");
    const back = within(dialog).getByRole("button", {
      name: "Back to Calendar",
    });
    expect(back).toHaveFocus();
    await screen.findByRole("group", { name: "Scheduled candidates" });
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex="0"]'
      )
    );
    focusable[focusable.length - 1].focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(back).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(view.props.onClose).toHaveBeenCalledOnce();
    view.unmount();
    expect(opener).toHaveFocus();
    expect(document.documentElement.className).toBe(expectedClasses);
    expect(document.body.style.overflow).toBe("scroll");
    document.documentElement.className = previousClasses;
    document.body.style.overflow = previousOverflow;
    opener.remove();
  });

  it("retains a pre-existing document overlay class when it closes", () => {
    const previousClasses = document.documentElement.className;
    document.documentElement.classList.add("fets-calendar-insights-open");
    const expectedClasses = document.documentElement.className;
    const view = show();
    view.unmount();
    expect(document.documentElement.className).toBe(expectedClasses);
    document.documentElement.className = previousClasses;
  });
});
