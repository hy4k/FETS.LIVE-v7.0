import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import "./chrome.css";

type CalendarView = "month" | "week" | "day" | "seats";
type Props = {
  branchLabel: string;
  periodLabel: string;
  monthLabel: string;
  view: CalendarView;
  canEdit: boolean;
  unavailable?: boolean;
  refreshing?: boolean;
  summary?: {
    candidates: number;
    sessionCount: number;
    bookedDays: number;
    complete: boolean;
  };
  search: string;
  provider: string;
  providerOptions: { code: string; label: string }[];
  onView: (value: CalendarView) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onToday: () => void;
  onSearch: (value: string) => void;
  onProvider: (value: string) => void;
  onClear: () => void;
  onAnalysis: () => void;
  onAdd: () => void;
  onRoster: (mode: "upload" | "manual") => void;
  onRefresh?: () => void;
};

export default function CalendarChrome(props: Props) {
  const [entryOpen, setEntryOpen] = useState(false);
  const entryRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstFocus = useRef<"first" | "last">("first");
  const menuId = useId();
  useEffect(() => {
    if (!entryOpen) return;
    const items =
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items?.[firstFocus.current === "last" ? items.length - 1 : 0]?.focus();
    const outside = (event: PointerEvent) => {
      if (!entryRef.current?.contains(event.target as Node))
        setEntryOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [entryOpen]);
  useEffect(() => {
    if (!props.canEdit) setEntryOpen(false);
  }, [props.canEdit]);
  const closeEntry = () => {
    setEntryOpen(false);
    triggerRef.current?.focus();
  };
  const activeFilters = !!props.search || props.provider !== "all";
  const providerLabel =
    props.providerOptions.find((item) => item.code === props.provider)?.label ||
    props.provider;
  return (
    <section className="cal-chrome" aria-label="Calendar controls">
      <header className="cal-heading">
        <div>
          <h1>Calendar</h1>
          <p>
            {props.branchLabel}
            <span>India time</span>
          </p>
        </div>
        <div className="cal-heading-actions">
          <button
            type="button"
            className="cal-button cal-secondary"
            onClick={props.onAnalysis}
          >
            <BarChart3 size={16} aria-hidden="true" />
            Analytics
          </button>
          {props.canEdit && (
            <div className="cal-entry" ref={entryRef}>
              <button
                ref={triggerRef}
                type="button"
                className="cal-button cal-secondary"
                aria-label="Candidate roster"
                aria-haspopup="menu"
                aria-expanded={entryOpen}
                aria-controls={menuId}
                onClick={() => {
                  firstFocus.current = "first";
                  setEntryOpen((open) => !open);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    firstFocus.current =
                      event.key === "ArrowUp" ? "last" : "first";
                    setEntryOpen(true);
                  }
                  if (event.key === "Escape") closeEntry();
                }}
              >
                <Users size={16} aria-hidden="true" />
                Candidates
                <ChevronDown size={13} aria-hidden="true" />
              </button>
              {entryOpen && (
                <div
                  id={menuId}
                  ref={menuRef}
                  className="cal-entry-menu"
                  role="menu"
                  aria-label="Candidate roster actions"
                  onKeyDown={(event) => {
                    const items = Array.from(
                      menuRef.current?.querySelectorAll<HTMLElement>(
                        '[role="menuitem"]'
                      ) || []
                    );
                    const index = items.indexOf(
                      document.activeElement as HTMLElement
                    );
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      closeEntry();
                    }
                    if (event.key === "Tab") {
                      closeEntry();
                    }
                    if (
                      ["ArrowDown", "ArrowUp", "Home", "End"].includes(
                        event.key
                      )
                    ) {
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                          ? items.length - 1
                          : (index +
                              (event.key === "ArrowDown" ? 1 : -1) +
                              items.length) %
                            items.length;
                      items[next]?.focus();
                    }
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    aria-label="Upload roster"
                    onClick={() => {
                      closeEntry();
                      props.onRoster("upload");
                    }}
                  >
                    <ArrowDownToLine size={16} aria-hidden="true" />
                    <span>
                      Upload roster<small>Import an Excel candidate list</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    aria-label="Add by hand"
                    onClick={() => {
                      closeEntry();
                      props.onRoster("manual");
                    }}
                  >
                    <Plus size={16} aria-hidden="true" />
                    <span>
                      Add by hand<small>Enter candidate details</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
          {props.canEdit && (
            <button
              type="button"
              className="cal-button cal-primary"
              onClick={props.onAdd}
            >
              <Plus size={16} aria-hidden="true" />
              Add session
            </button>
          )}
        </div>
      </header>
      <section className="cal-month-ledger" aria-label="Calendar month summary">
        <div className="cal-summary-scope">
          <strong>{props.monthLabel}</strong>
          <span>All providers</span>
          {props.refreshing && <small role="status">Updating…</small>}
        </div>
        <dl>
          {[
            {
              label:
                props.summary?.complete === false
                  ? "Known scheduled candidates"
                  : "Scheduled candidates",
              value: props.summary?.candidates,
            },
            { label: "Exam sessions", value: props.summary?.sessionCount },
            { label: "Booked days", value: props.summary?.bookedDays },
          ].map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>
                {props.unavailable || item.value === undefined
                  ? "—"
                  : item.value.toLocaleString("en-IN")}
              </dd>
            </div>
          ))}
        </dl>
        <a className="cal-roster-link" href="/roster">
          Staff roster
        </a>
      </section>
      {props.unavailable && (
        <div role="alert" className="cal-read-error">
          Calendar bookings could not be loaded.
          {props.onRefresh && (
            <button type="button" onClick={props.onRefresh}>
              Retry
            </button>
          )}
        </div>
      )}
      <div className="cal-control-band">
        <div className="cal-navigation-row">
          <div className="cal-period-controls">
            <div className="cal-period-switch">
              <button
                type="button"
                aria-label="Previous calendar period"
                onClick={() => props.onNavigate("prev")}
              >
                <ChevronLeft size={18} />
              </button>
              <h2 aria-live="polite">{props.periodLabel}</h2>
              <button
                type="button"
                aria-label="Next calendar period"
                onClick={() => props.onNavigate("next")}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              type="button"
              className="cal-button cal-today"
              onClick={props.onToday}
            >
              Today
            </button>
          </div>
          <div
            className="cal-view-switch"
            role="group"
            aria-label="Calendar view"
          >
            {(
              [
                ["month", "Month"],
                ["week", "Week"],
                ["day", "Day"],
                ["seats", "Seat management"],
              ] as [CalendarView, string][]
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={props.view === value}
                onClick={() => props.onView(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="cal-filter-row">
          <label className="cal-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search sessions"
              placeholder="Search sessions…"
              value={props.search}
              onChange={(event) => props.onSearch(event.target.value)}
            />
          </label>
          <label className="cal-provider">
            <span>Provider</span>
            <select
              aria-label="Filter by provider"
              value={props.provider}
              onChange={(event) => props.onProvider(event.target.value)}
            >
              <option value="all">All providers</option>
              {props.providerOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="cal-filter-context">
            {activeFilters ? (
              <>
                <span>Schedule filters</span>
                {props.search && (
                  <button
                    type="button"
                    onClick={() => props.onSearch("")}
                    aria-label="Remove search filter"
                  >
                    {props.search}
                    <X size={12} />
                  </button>
                )}
                {props.provider !== "all" && (
                  <button
                    type="button"
                    onClick={() => props.onProvider("all")}
                    aria-label="Remove provider filter"
                  >
                    {providerLabel}
                    <X size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className="cal-clear"
                  onClick={props.onClear}
                >
                  Clear filters
                </button>
              </>
            ) : (
              <span>Choose a date to review its sessions.</span>
            )}
          </div>
        </div>
        {props.view === "seats" && activeFilters && (
          <p className="cal-scope-note">
            Seat management includes all providers, including sessions hidden by
            schedule filters.
          </p>
        )}
      </div>
    </section>
  );
}
