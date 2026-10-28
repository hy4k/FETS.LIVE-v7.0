import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MyDeskHome from "./MyDeskHome";
vi.mock("../desk-workspace/HelpDesk", () => ({
  default: () => <div>Client support</div>,
}));
vi.mock("../desk-workspace/TeamRound", () => ({
  default: () => <div>The team round</div>,
}));
vi.mock("../desk-workspace/SwapInvitations", () => ({ default: () => null }));
const repository = {
  load: vi
    .fn()
    .mockResolvedValue({ day: "2026-10-28", choice: null, participants: [] }),
  join: vi.fn(),
};
const props = () => ({
  user: {
    id: "staff",
    name: "Alex Thomas",
    role: "Staff",
    branch: "Calicut",
    joiningDate: "2026-10-01",
  },
  people: [],
  pendingHandovers: null,
  navigate: vi.fn(),
  openDrawer: vi.fn(),
  openChat: vi.fn(),
  renderPanel: vi.fn((panel, kind) => (
    <p>
      {panel} {kind}
    </p>
  )),
  roundRepository: repository,
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (window as any).FETS;
});
describe("My Desk workspace", () => {
  it("puts the real full name above My Desk and uses the saved joining date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    render(<MyDeskHome {...props()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Alex Thomas",
    );
    expect(screen.getByText("28")).toBeInTheDocument();
    expect(screen.getByText("Joined 1 Oct 2026")).toBeInTheDocument();
    expect(screen.queryByText("Start focus")).not.toBeInTheDocument();
    for (const text of ["My time", "Checklist", "Thought worth keeping"])
      expect(screen.queryByText(text)).not.toBeInTheDocument();
  });
  it("explains a missing joining date without substituting account creation", () => {
    render(
      <MyDeskHome
        {...props()}
        user={{ ...props().user, joiningDate: undefined }}
      />,
    );
    expect(screen.getByText("Joining date not added")).toBeInTheDocument();
  });
  it.each([
    ["Leave", "leave"],
    ["Half-day leave", "halfday"],
    ["TOIL day off", "toil"],
    ["Shift swap", "swap"],
  ])("opens %s directly", (label, kind) => {
    const p = props();
    render(<MyDeskHome {...p} />);
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp("^" + label) }),
    );
    expect(p.renderPanel).toHaveBeenLastCalledWith("requests", kind);
    fireEvent.click(screen.getByRole("button", { name: "Back to My Desk" }));
    expect(
      screen.getByRole("button", { name: /^Shift swap/ }),
    ).toBeInTheDocument();
  });
  it("opens requests from an existing in-app deep link", () => {
    (window as any).FETS = { _deskTab: "requests" };
    const p = props();
    render(<MyDeskHome {...p} />);
    expect(p.renderPanel).toHaveBeenLastCalledWith("requests", undefined);
  });
  it("moves Case and Vault out of My Desk and resets request forms when account changes", () => {
    const p = props(),
      v = render(<MyDeskHome {...p} />);
    expect(
      screen.queryByRole("button", {
        name: /Raise a case|F Vault|Quick access/,
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Shift swap/ }));
    v.rerender(
      <MyDeskHome
        {...p}
        user={{ ...p.user, id: "other", name: "Other Person" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^Shift swap/ }),
    ).toBeInTheDocument();
  });
});
