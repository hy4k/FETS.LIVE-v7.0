import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TeamRound from "./TeamRound";
afterEach(cleanup);
it("loads real participation without joining on behalf of the user; saves only a deliberate answer", async () => {
  const state = {
    day: "2026-10-28",
    choice: null,
    participants: [{ name: "Example Person" }],
  };
  const repo = {
    load: vi.fn().mockResolvedValue(state),
    join: vi
      .fn()
      .mockResolvedValue({
        ...state,
        choice: 0,
        participants: [...state.participants, { name: "You" }],
      }),
  };
  render(<TeamRound repository={repo} />);
  await screen.findByText("1 person has joined today");
  expect(repo.join).not.toHaveBeenCalled();
  const join = screen.getByRole("button", { name: /Join today/ });
  expect(join).toBeDisabled();
  fireEvent.click(screen.getAllByRole("button", { pressed: false })[0]);
  fireEvent.click(join);
  await waitFor(() => expect(repo.join).toHaveBeenCalledWith(0, "2026-10-28"));
  await screen.findByText("2 people have joined today");
  expect(screen.getByText(/Today’s round complete/)).toBeInTheDocument();
});
it("reports connection failures instead of claiming empty participation", async () => {
  render(
    <TeamRound
      repository={{
        load: vi.fn().mockRejectedValue(new Error("Offline")),
        join: vi.fn(),
      }}
    />,
  );
  await screen.findByRole("alert");
  expect(screen.getByText("Team progress unavailable")).toBeInTheDocument();
  expect(
    screen.queryByText("0 people have joined today"),
  ).not.toBeInTheDocument();
});
