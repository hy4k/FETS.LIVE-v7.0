import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./overlay.css";

export interface CalendarOverlayProps {
  title: string;
  onClose: () => void;
  dark: boolean;
  children: ReactNode;
}

type SavedStyle = {
  element: HTMLElement;
  property: string;
  value: string;
  priority: string;
};

export function CalendarOverlay({
  title,
  onClose,
  dark,
  children,
}: CalendarOverlayProps) {
  const root = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const focusFirst = useRef<() => void>(() => {});
  close.current = onClose;

  useLayoutEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const documentClass = "fets-calendar-overlay-open";
    const alreadyOpen =
      document.documentElement.classList.contains(documentClass);
    const saved: SavedStyle[] = [];
    const save = (element: HTMLElement, properties: string[]) => {
      for (const property of properties)
        saved.push({
          element,
          property,
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property),
        });
    };
    save(document.documentElement, ["transform", "-webkit-transform"]);
    save(document.body, [
      "transform",
      "-webkit-transform",
      "overflow",
      "overflow-x",
      "overflow-y",
    ]);
    document.documentElement.classList.add(documentClass);
    for (const element of [document.documentElement, document.body]) {
      element.style.setProperty("transform", "none", "important");
      element.style.setProperty("-webkit-transform", "none", "important");
    }
    document.body.style.setProperty("overflow", "hidden", "important");

    const focusables = () =>
      Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]'
        ) || []
      ).filter((element) => {
        if (
          element.matches(":disabled") ||
          element.closest('[hidden], [inert], [aria-hidden="true"]') ||
          element.getAttribute("aria-disabled") === "true"
        )
          return false;
        if (
          element.closest("details:not([open])") &&
          element.tagName !== "SUMMARY"
        )
          return false;
        for (
          let ancestor: HTMLElement | null = element;
          ancestor && ancestor !== root.current;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          if (style.display === "none" || style.visibility === "hidden")
            return false;
        }
        return true;
      });
    const firstButton = () =>
      focusables().find((element) => element.tagName === "BUTTON") ||
      root.current;
    focusFirst.current = () => firstButton()?.focus({ preventScroll: true });

    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusables();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        root.current?.focus({ preventScroll: true });
        return;
      }
      const outside =
        !root.current?.contains(document.activeElement) ||
        document.activeElement === root.current;
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || outside)
      ) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        firstButton()?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("focusin", containFocus);
      // Remove the temporary shorthand before restoring individual longhands.
      for (const { element, property } of saved)
        element.style.removeProperty(property);
      for (const { element, property, value, priority } of saved)
        if (value) element.style.setProperty(property, value, priority);
      if (!alreadyOpen)
        document.documentElement.classList.remove(documentClass);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Details and its edit form share this portal and original Calendar opener.
  // Move focus to the new visible panel whenever that dialog mode changes.
  useLayoutEffect(() => {
    focusFirst.current();
  }, [title]);

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      data-theme={dark ? "dark" : "light"}
      className="fets-calendar-standalone-mint sovereign-theme planning-calendar fets-calendar-overlay"
    >
      {children}
    </div>,
    document.body
  );
}

export default CalendarOverlay;
