import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MyTime from "./MyTime";
import type { TimeData } from "./time-model";
const sample: TimeData = {
  schedules: [
    {
      id: "s",
      profile_id: "me",
      date: "2026-10-01",
      branch_location: "calicut",
      shift_code: "D",
      shift_label: "Early shift",
      shift_start: "06:00",
      shift_end: "15:00",
      grace_minutes: 0,
      overtime_hours: 0,
      version: 1,
    },
  ],
  attendance: [
    {
      id: "a",
      staff_id: "me",
      date: "2026-10-01",
      check_in: "06:00",
      check_out: "15:00",
      status: "present",
      notes: null,
      branch_location: "calicut",
    },
  ],
};
afterEach(cleanup);
it("loads own monthly records and shows the saved custom hours on selection without application controls", async () => {
  const load = vi.fn().mockResolvedValue(sample);
  render(<MyTime profileId="me" repository={{ load }} />);
  await screen.findByText("Weekly hours");
  expect(load).toHaveBeenCalledWith(
    "me",
    expect.stringMatching(/^\d{4}-\d{2}-01$/),
    expect.any(String),
  );
  fireEvent.change(screen.getByLabelText("Analysis month"), {
    target: { value: "2026-10" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: /1 Oct: Completed work/ }),
  );
  const detail = screen.getByRole("complementary", {
    name: "Selected day details",
  });
  expect(within(detail).getByText("Early shift")).toBeInTheDocument();
  expect(within(detail).getByText("6:00 AM – 3:00 PM")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", {
      name: /apply|request|checklist|chat|focus/i,
    }),
  ).not.toBeInTheDocument();
});
it("shows load failure and recovers via Retry instead of claiming zero hours", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(Error("Connection unavailable"))
    .mockResolvedValue(sample);
  render(<MyTime profileId="me" repository={{ load }} />);
  await screen.findByRole("alert");
  expect(screen.queryByText("Recorded work")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Weekly hours");
  expect(load).toHaveBeenCalledTimes(2);
});
it("ignores a slow result for the previous signed-in person", async () => {
  let resolve: (v: TimeData) => void = () => {};
  const load = vi
    .fn()
    .mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    .mockResolvedValue({ schedules: [], attendance: [] });
  const v = render(<MyTime profileId="me" repository={{ load }} />);
  v.rerender(<MyTime profileId="other" repository={{ load }} />);
  await screen.findByText("Weekly hours");
  await act(async () => {
    resolve(sample);
  });
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: /Completed work/ }),
    ).not.toBeInTheDocument(),
  );
});
