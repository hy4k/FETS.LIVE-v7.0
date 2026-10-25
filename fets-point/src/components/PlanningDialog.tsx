import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./planning-workspace.css";
export function PlanningDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]',
          ) || [],
        ).filter((e) => e.getClientRects().length);
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="pw-backdrop">
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pw-dialog"
      >
        <header className="pw-header">
          <div>
            <small>FETS · PLANNING</small>
            <h1>{title}</h1>
          </div>
          <button onClick={onClose} aria-label={`Close ${title}`}>
            Close ×
          </button>
        </header>
        <div className="pw-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
