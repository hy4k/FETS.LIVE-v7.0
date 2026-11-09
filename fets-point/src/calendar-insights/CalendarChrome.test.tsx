import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CalendarChrome from "./CalendarChrome";

function show(overrides = {}) {
  const actions = {
    onView: vi.fn(),
    onNavigate: vi.fn(),
    onToday: vi.fn(),
    onSearch: vi.fn(),
    onProvider: vi.fn(),
    onClear: vi.fn(),
    onAnalysis: vi.fn(),
    onAdd: vi.fn(),
    onRoster: vi.fn(),
  };
  render(
    <CalendarChrome
      branchLabel="Kochi"
      periodLabel="November 2026"
      monthLabel="November 2026"
      view="month"
      canEdit
      summary={{
        candidates: 62,
        sessionCount: 2,
        bookedDays: 1,
        complete: true,
      }}
      search=""
      provider="all"
      providerOptions={[
        { code: "PEA", label: "Pearson VUE" },
        { code: "ITTS", label: "ITTS" },
      ]}
      {...actions}
      {...overrides}
    />
  );
  return actions;
}
describe("organised Calendar controls", () => {
  it("groups candidate entry actions in a dismissible menu and restores focus on Escape", () => {
    const actions = show();
    expect(screen.queryByRole("menu")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Candidate roster" });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Candidate roster actions" });
    expect(
      within(menu).getByRole("menuitem", { name: "Upload roster" })
    ).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(
      within(menu).getByRole("menuitem", { name: "Add by hand" })
    ).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Upload roster" }));
    expect(actions.onRoster).toHaveBeenCalledWith("upload");
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("closes the entry menu on outside interaction and protects edit-only actions", () => {
    show({ canEdit: false });
    expect(
      screen.queryByRole("button", { name: "Candidate roster" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Add session" })).toBeNull();
    expect(screen.getByRole("button", { name: "Analytics" })).toBeEnabled();
  });
  it("keeps view, date, provider and search controls accessible with only one provider selector", () => {
    const actions = show();
    expect(
      screen.getAllByRole("combobox", { name: "Filter by provider" })
    ).toHaveLength(1);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter by provider" }),
      { target: { value: "ITTS" } }
    );
    expect(actions.onProvider).toHaveBeenCalledWith("ITTS");
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search sessions" }),
      { target: { value: "MRCS" } }
    );
    expect(actions.onSearch).toHaveBeenCalledWith("MRCS");
    fireEvent.click(
      screen.getByRole("button", { name: "Next calendar period" })
    );
    expect(actions.onNavigate).toHaveBeenCalledWith("next");
    fireEvent.click(screen.getByRole("button", { name: "Seat management" }));
    expect(actions.onView).toHaveBeenCalledWith("seats");
    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByLabelText("Calendar month summary")).toHaveTextContent(
      "All providers"
    );
  });
  it("shows unavailable totals honestly and keeps clearing schedule filters separate from month scope", () => {
    const actions = show({
      summary: undefined,
      unavailable: true,
      search: "CMA",
      provider: "ITTS",
    });
    expect(screen.getByLabelText("Calendar month summary")).toHaveTextContent(
      "—"
    );
    expect(
      screen.getByText("Calendar bookings could not be loaded.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(actions.onClear).toHaveBeenCalledOnce();
  });
  it("dismisses candidate actions when the surrounding calendar is clicked", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Candidate roster" }));
    fireEvent.pointerDown(screen.getByRole("heading", { name: "Calendar" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
