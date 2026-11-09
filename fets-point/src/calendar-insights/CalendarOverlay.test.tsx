import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarOverlay } from "./CalendarOverlay";

let originalHtmlClasses: string;
let originalBodyStyles: string;
let originalHtmlStyles: string;
beforeEach(() => {
  originalHtmlClasses = document.documentElement.className;
  originalBodyStyles = document.body.style.cssText;
  originalHtmlStyles = document.documentElement.style.cssText;
});
afterEach(() => {
  cleanup();
  document.documentElement.className = originalHtmlClasses;
  document.body.style.cssText = originalBodyStyles;
  document.documentElement.style.cssText = originalHtmlStyles;
  vi.restoreAllMocks();
});

function show(dark = false) {
  const onClose = vi.fn();
  const onSave = vi.fn((event: React.FormEvent) => event.preventDefault());
  const children = (
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl overflow-hidden">
        <button type="button" hidden>
          Hidden close
        </button>
        <div style={{ display: "none" }}>
          <button type="button">Hidden ancestor</button>
        </div>
        <button type="button" onClick={onClose}>
          Close session
        </button>
        <form onSubmit={onSave}>
          <label>
            Exam name
            <input name="exam" />
          </label>
          <button type="button" disabled>
            Disabled action
          </button>
          <button type="submit">Save session</button>
        </form>
      </div>
    </div>
  );
  const view = render(
    <div style={{ transform: "translateZ(0)" }}>
      <CalendarOverlay title="Add session" dark={dark} onClose={onClose}>
        {children}
      </CalendarOverlay>
    </div>
  );
  return {
    ...view,
    onClose,
    onSave,
    rerenderOverlay: (nextDark: boolean, nextClose = onClose) =>
      view.rerender(
        <div style={{ transform: "translateZ(0)" }}>
          <CalendarOverlay
            title="Add session"
            dark={nextDark}
            onClose={nextClose}
          >
            {children}
          </CalendarOverlay>
        </div>
      ),
  };
}

describe("Calendar dialog portal", () => {
  it("moves existing modal contents out of the transformed Calendar and retains their theme and handlers", () => {
    const view = show();
    const dialog = screen.getByRole("dialog", { name: "Add session" });
    expect(dialog.parentElement).toBe(document.body);
    expect(view.container).not.toContainElement(
      screen.getByLabelText("Exam name")
    );
    expect(dialog).toHaveAttribute("data-theme", "light");
    expect(dialog).toHaveClass(
      "fets-calendar-standalone-mint",
      "sovereign-theme",
      "planning-calendar"
    );
    fireEvent.change(screen.getByLabelText("Exam name"), {
      target: { value: "Updated exam" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save session" }));
    expect(view.onSave).toHaveBeenCalledOnce();
    view.rerenderOverlay(true);
    expect(dialog).toHaveAttribute("data-theme", "dark");
    expect(screen.getByLabelText("Exam name")).toHaveValue("Updated exam");
  });

  it("focuses the first visible enabled button without scrolling, traps Tab both ways and restores its opener", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const view = show();
    const dialog = screen.getByRole("dialog", { name: "Add session" });
    const first = screen.getByRole("button", { name: "Close session" });
    const last = screen.getByRole("button", { name: "Save session" });
    expect(first).toHaveFocus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(first).toHaveFocus();
    opener.focus();
    expect(first).toHaveFocus();
    view.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("closes on Escape with the latest callback without refocusing when props update", () => {
    const view = show();
    screen.getByLabelText("Exam name").focus();
    const nextClose = vi.fn();
    view.rerenderOverlay(true, nextClose);
    expect(screen.getByLabelText("Exam name")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(nextClose).toHaveBeenCalledOnce();
    expect(view.onClose).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "restores existing document classes, transform styles and scroll rules (already open: %s)",
    (alreadyOpen) => {
      document.documentElement.className = `existing-shell${
        alreadyOpen ? " fets-calendar-overlay-open" : ""
      }`;
      document.documentElement.style.setProperty(
        "transform",
        "scale(1)",
        "important"
      );
      document.body.style.setProperty(
        "transform",
        "translateZ(0)",
        "important"
      );
      document.body.style.setProperty("overflow-x", "auto", "important");
      document.body.style.setProperty("overflow-y", "scroll");
      document.body.style.setProperty("color", "rgb(30, 40, 50)");
      const before = {
        classes: document.documentElement.className,
        htmlTransform:
          document.documentElement.style.getPropertyValue("transform"),
        bodyTransform: document.body.style.getPropertyValue("transform"),
        bodyTransformPriority:
          document.body.style.getPropertyPriority("transform"),
      };
      const view = show();
      expect(document.documentElement.style.transform).toBe("none");
      expect(document.body.style.transform).toBe("none");
      expect(document.body.style.overflow).toBe("hidden");
      view.unmount();
      expect(document.documentElement.className).toBe(before.classes);
      expect(document.documentElement.style.transform).toBe(
        before.htmlTransform
      );
      expect(document.body.style.transform).toBe(before.bodyTransform);
      expect(document.body.style.getPropertyPriority("transform")).toBe(
        before.bodyTransformPriority
      );
      expect(document.body.style.overflowX).toBe("auto");
      expect(document.body.style.getPropertyPriority("overflow-x")).toBe(
        "important"
      );
      expect(document.body.style.overflowY).toBe("scroll");
      expect(document.body.style.color).toBe("rgb(30, 40, 50)");
    }
  );

  it("focuses the dialog when its contents have no buttons and retains a usable keyboard escape", () => {
    const onClose = vi.fn();
    render(
      <CalendarOverlay title="Session details" dark={false} onClose={onClose}>
        <p>Session details</p>
      </CalendarOverlay>
    );
    const dialog = screen.getByRole("dialog", { name: "Session details" });
    expect(dialog).toHaveFocus();
    expect(within(dialog).getByText("Session details")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
