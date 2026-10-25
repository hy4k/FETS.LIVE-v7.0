import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
const motionSettings = vi.hoisted(() => ({ reduce: false }));
vi.mock("framer-motion", () => ({
  useReducedMotion: () => motionSettings.reduce,
  AnimatePresence: ({ children }: any) => children,
  motion: {
    div: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
  },
}));
import HomeSessionCard from "./HomeSessionCard";
afterEach(() => {
  motionSettings.reduce = false;
  cleanup();
  vi.useRealTimers();
});
const sessions = [
  {
    id: 1,
    client_name: "PARAGON",
    exam_name: "CELPIP",
    start_time: "09:00",
    end_time: "11:00",
    candidate_count: 12,
  },
  { id: 2, client_name: "PROMETRIC", exam_name: "CMA US", candidate_count: 20 },
];
it("presents one session at a time with reading time, pause and manual navigation", () => {
  vi.useFakeTimers();
  render(
    <HomeSessionCard
      sessions={sessions}
      loading={false}
      error={false}
      onOpen={() => {}}
    />,
  );
  expect(screen.getByText("CELPIP")).toBeVisible();
  expect(screen.queryByText("CMA US")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(7000));
  expect(screen.getByText("CMA US")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Pause sessions" }));
  act(() => vi.advanceTimersByTime(30000));
  expect(screen.getByText("CMA US")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Previous session" }));
  expect(screen.getByText("CELPIP")).toBeVisible();
});
it("excludes cancelled sessions and keeps the calendar action available", () => {
  const onOpen = vi.fn();
  render(
    <HomeSessionCard
      sessions={[{ ...sessions[0], status: "cancelled" }]}
      loading={false}
      error={false}
      onOpen={onOpen}
    />,
  );
  expect(screen.getByText("No sessions scheduled today.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
  expect(onOpen).toHaveBeenCalled();
});

it("respects reduced motion while keeping manual session controls", () => {
  motionSettings.reduce = true;
  vi.useFakeTimers();
  render(
    <HomeSessionCard
      sessions={sessions}
      loading={false}
      error={false}
      onOpen={() => {}}
    />,
  );
  act(() => vi.advanceTimersByTime(30000));
  expect(screen.getByText("CELPIP")).toBeVisible();
  expect(screen.getByRole("button", { name: "Pause sessions" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next session" }));
  expect(screen.getByText("CMA US")).toBeVisible();
});
