import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  RefreshCw,
  ArrowUpRight,
  Download,
  Clock3,
  SlidersHorizontal,
  Check,
  CalendarDays,
} from "lucide-react";
import { rosterRepository, type RosterRepository } from "./repository";
import {
  CODES,
  WORK_CODES,
  plainShift,
  effectiveShift,
  halfShift,
  clockParts,
  formatTime,
  duration,
  monthDays,
  addDays,
  shiftName,
  timing,
  validateShift,
  patternDates,
  attendanceMetrics,
  csvCell,
  type Shift,
  type Schedule,
  type Person,
  type Snapshot,
  type ShiftType,
  type Change,
  type Segment,
} from "./model";
import { isStaffRosterVisible } from "../utils/rosterVisibility";
import "./roster-workspace.css";
const empty: Snapshot = {
  people: [],
  schedules: [],
  attendance: [],
  types: [],
};
const branchName = (b: string) =>
  b === "global" ? "Both centres" : b === "cochin" ? "Cochin" : "Calicut";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Could not load the roster. Try again.";
const prettyDate = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      className="rw-dialog"
      ref={ref}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="rw-icon" onClick={onClose} aria-label="Close dialog">
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function ShiftFields({
  value,
  onChange,
  types,
  requireName = false,
}: {
  value: Shift;
  onChange: (v: Shift) => void;
  types: ShiftType[];
  requireName?: boolean;
}) {
  const [preset, setPreset] = useState("custom");
  const [halfBase, setHalfBase] = useState("normal");
  const [halfCustom, setHalfCustom] = useState<Shift>(plainShift());
  const working = WORK_CODES.has(value.shift_code);
  const full =
    halfBase === "current"
      ? halfCustom
      : types.find((t) => t.id === halfBase) || plainShift();
  return (
    <div className="rw-fields">
      {!!types.length && (
        <label>
          Saved shift
          <select
            aria-label="Saved shift"
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              const type = types.find((t) => t.id === e.target.value);
              if (type) onChange({ ...type });
            }}
          >
            <option value="custom">Set details below</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shift_label} · {timing(t)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Roster type
        <select
          aria-label="Roster type"
          value={value.shift_code}
          onChange={(e) => {
            setPreset("custom");
            if (
              e.target.value === "HD" &&
              value.shift_code !== "HD" &&
              WORK_CODES.has(value.shift_code)
            ) {
              setHalfCustom(value);
              setHalfBase("current");
            }
            onChange(
              e.target.value === "HD"
                ? halfShift(
                    value.shift_code !== "HD" &&
                      WORK_CODES.has(value.shift_code) &&
                      value.shift_start
                      ? value
                      : plainShift(),
                    "first",
                  )
                : plainShift(e.target.value),
            );
          }}
        >
          {Object.entries(CODES)
            .filter(([k]) => k !== "E" && (!requireName || WORK_CODES.has(k)))
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v} ({k})
              </option>
            ))}
        </select>
      </label>
      {working && (
        <>
          {value.shift_code === "HD" && (
            <div className="rw-half">
              <label>
                Half of this full shift
                <select
                  aria-label="Half of this full shift"
                  value={halfBase}
                  onChange={(e) => {
                    setHalfBase(e.target.value);
                    const base =
                      e.target.value === "current"
                        ? halfCustom
                        : types.find((t) => t.id === e.target.value) ||
                          plainShift();
                    onChange(halfShift(base, "first"));
                  }}
                >
                  <option value="normal">Normal · 8 AM–5 PM</option>
                  {halfBase === "current" && (
                    <option value="current">
                      Current shift · {timing(halfCustom)}
                    </option>
                  )}
                  {types
                    .filter((t) => t.shift_code !== "HD")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.shift_label} · {timing(t)}
                      </option>
                    ))}
                </select>
              </label>
              <div className="rw-presets">
                <button
                  type="button"
                  onClick={() => onChange(halfShift(full, "first"))}
                >
                  First half
                </button>
                <button
                  type="button"
                  onClick={() => onChange(halfShift(full, "second"))}
                >
                  Second half
                </button>
              </div>
              <small>
                A nine-hour shift gives a 4½-hour half day. The saved hours
                below are used for attendance and overtime.
              </small>
            </div>
          )}
          <label>
            Shift name {requireName ? "" : "(optional)"}
            <input
              maxLength={50}
              placeholder="e.g. CMA early"
              value={value.shift_label || ""}
              onChange={(e) =>
                onChange({ ...value, shift_label: e.target.value || null })
              }
            />
          </label>
          <div className="rw-two">
            <label>
              Start time
              <input
                type="time"
                required
                value={value.shift_start?.slice(0, 5) || ""}
                onChange={(e) =>
                  onChange({ ...value, shift_start: e.target.value || null })
                }
              />
            </label>
            <label>
              End time
              <input
                type="time"
                required
                value={value.shift_end?.slice(0, 5) || ""}
                onChange={(e) =>
                  onChange({ ...value, shift_end: e.target.value || null })
                }
              />
            </label>
          </div>
          <label>
            Late-arrival grace (minutes)
            <input
              aria-label="Late-arrival grace (minutes)"
              type="number"
              min={0}
              max={60}
              value={value.grace_minutes}
              onChange={(e) =>
                onChange({ ...value, grace_minutes: Number(e.target.value) })
              }
            />
            <small>
              Late minutes start after this allowance. Early departure uses the
              scheduled end time.
            </small>
          </label>
        </>
      )}
    </div>
  );
}
function EditEntry({
  person,
  date,
  existing,
  types,
  branch,
  repo,
  onSaved,
  onClose,
}: {
  person: Person;
  date: string;
  existing?: Schedule;
  types: ShiftType[];
  branch: string;
  repo: RosterRepository;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState<Shift>(
    existing
      ? effectiveShift({
          ...existing,
          shift_code: existing.shift_code === "E" ? "D" : existing.shift_code,
        })
      : plainShift(),
  );
  const [ot, setOt] = useState(existing?.overtime_hours || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(remove = false) {
    setError("");
    try {
      if (!remove) validateShift(value);
      if (!Number.isFinite(ot) || ot < 0 || ot > 24)
        throw Error("Approved overtime must be 0–24 hours.");
      setBusy(true);
      await repo.save([
        {
          profile_id: person.id,
          date,
          branch_location: existing?.branch_location || branch,
          expected_version: existing?.version ?? null,
          value: remove
            ? null
            : {
                ...value,
                overtime_hours: WORK_CODES.has(value.shift_code) ? ot : 0,
              },
        },
      ]);
      onSaved();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={`${person.full_name} · ${prettyDate(date)}`}
      onClose={() => !busy && onClose()}
    >
      <ShiftFields value={value} onChange={setValue} types={types} />
      {WORK_CODES.has(value.shift_code) && (
        <label>
          Approved overtime (hours)
          <input
            type="number"
            min={0}
            max={24}
            step="any"
            value={ot}
            onChange={(e) => setOt(Number(e.target.value))}
          />
        </label>
      )}
      {error && (
        <p className="rw-error" role="alert">
          {error}
        </p>
      )}
      <footer>
        {existing && (
          <button
            disabled={busy}
            className="rw-text danger"
            onClick={() => save(true)}
          >
            Clear entry
          </button>
        )}
        <button disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button disabled={busy} className="rw-primary" onClick={() => save()}>
          {busy ? "Saving…" : "Save entry"}
        </button>
      </footer>
    </Dialog>
  );
}
function QuickAdd({
  people,
  types,
  branch,
  repo,
  onSaved,
  onClose,
}: {
  people: Person[];
  types: ShiftType[];
  branch: string;
  repo: RosterRepository;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [personId, setPersonId] = useState(people[0]?.id || "");
  const [from, setFrom] = useState(clockParts().day);
  const [to, setTo] = useState(clockParts().day);
  const [mode, setMode] = useState<"continuous" | "cycle" | "weekdays">(
    "continuous",
  );
  const [value, setValue] = useState<Shift>(plainShift());
  const [segments, setSegments] = useState<Segment[]>([
    { days: 6, shift: plainShift() },
    { days: 1, shift: plainShift("RD") },
  ]);
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] = useState<{
    changes: Change[];
    skipped: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const person = people.find((p) => p.id === personId);
  const centre =
    branch === "global"
      ? (person?.branch_assigned || "calicut").toLowerCase()
      : branch;
  function change(fn: () => void) {
    fn();
    setPreview(null);
    setError("");
  }
  async function review() {
    setError("");
    try {
      if (!person) throw Error("Choose a staff member.");
      const proposed = patternDates(from, to, mode, value, segments, weekdays);
      proposed.forEach((x) => validateShift(x.shift));
      setBusy(true);
      const current = await repo.range(person.id, from, to);
      let skipped = 0;
      const changes: Change[] = [];
      for (const p of proposed) {
        const old = current.find((r) => r.date === p.date);
        if (old && !replace) {
          skipped++;
          continue;
        }
        changes.push({
          profile_id: person.id,
          date: p.date,
          branch_location: old?.branch_location || centre,
          expected_version: old?.version ?? null,
          value: {
            ...p.shift,
            overtime_hours: WORK_CODES.has(p.shift.shift_code)
              ? old?.overtime_hours || 0
              : 0,
          },
        });
      }
      setPreview({ changes, skipped });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!preview?.changes.length) return;
    setBusy(true);
    setError("");
    try {
      await repo.save(preview.changes);
      onSaved();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Quick Add" onClose={() => !busy && onClose()}>
      <fieldset disabled={busy} className="rw-fieldset">
        <label>
          Staff member
          <select
            aria-label="Staff member"
            value={personId}
            onChange={(e) => change(() => setPersonId(e.target.value))}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <div className="rw-two">
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => change(() => setFrom(e.target.value))}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              min={from}
              value={to}
              onChange={(e) => change(() => setTo(e.target.value))}
            />
          </label>
        </div>
        <label>
          Pattern
          <select
            aria-label="Pattern"
            value={mode}
            onChange={(e) =>
              change(() => setMode(e.target.value as typeof mode))
            }
          >
            <option value="continuous">Every day in the range</option>
            <option value="weekdays">Selected weekdays</option>
            <option value="cycle">Repeating pattern</option>
          </select>
        </label>
        {mode === "weekdays" && (
          <div className="rw-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <label key={d}>
                <input
                  type="checkbox"
                  checked={weekdays.includes(i)}
                  onChange={() =>
                    change(() =>
                      setWeekdays((x) =>
                        x.includes(i) ? x.filter((n) => n !== i) : [...x, i],
                      ),
                    )
                  }
                />
                {d}
              </label>
            ))}
          </div>
        )}
        {mode === "cycle" ? (
          <div className="rw-segments">
            {segments.map((s, i) => (
              <section key={i}>
                <div className="rw-segment-head">
                  <b>Part {i + 1}</b>
                  <label>
                    Days
                    <input
                      type="number"
                      min={1}
                      max={366}
                      value={s.days}
                      onChange={(e) =>
                        change(() =>
                          setSegments((x) =>
                            x.map((v, j) =>
                              j === i
                                ? { ...v, days: Number(e.target.value) }
                                : v,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  {segments.length > 1 && (
                    <button
                      aria-label={`Remove part ${i + 1}`}
                      className="rw-icon"
                      onClick={() =>
                        change(() =>
                          setSegments((x) => x.filter((_, j) => j !== i)),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <ShiftFields
                  value={s.shift}
                  onChange={(v) =>
                    change(() =>
                      setSegments((x) =>
                        x.map((p, j) => (j === i ? { ...p, shift: v } : p)),
                      ),
                    )
                  }
                  types={types.filter((t) => t.branch_location === centre)}
                />
              </section>
            ))}
            <button
              onClick={() =>
                change(() =>
                  setSegments((x) => [
                    ...x,
                    { days: 1, shift: plainShift("RD") },
                  ]),
                )
              }
            >
              <Plus size={15} /> Add part
            </button>
            <small>
              The pattern starts on the From date and repeats through the final
              date.
            </small>
          </div>
        ) : (
          <ShiftFields
            value={value}
            onChange={(v) => change(() => setValue(v))}
            types={types.filter((t) => t.branch_location === centre)}
          />
        )}
        <label className="rw-check">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => change(() => setReplace(e.target.checked))}
          />
          Replace existing roster entries in this range
        </label>
      </fieldset>
      {preview && (
        <section className="rw-preview" aria-label="Date preview">
          <strong>
            {preview.changes.length} dates to save · {preview.skipped} existing
            entries kept
          </strong>
          {replace && (
            <p>
              Existing shifts and leave on these dates will be replaced.
              Approved overtime on working days is retained.
            </p>
          )}
          <div>
            {preview.changes.map((c) => (
              <p key={c.date}>
                <span>{prettyDate(c.date)}</span>
                <b>{shiftName(c.value!)}</b>
                <small>{timing(c.value!)}</small>
              </p>
            ))}
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="rw-error">
          {error}
        </p>
      )}
      <footer>
        <button disabled={busy} onClick={onClose}>
          Cancel
        </button>
        {preview ? (
          <button
            className="rw-primary"
            disabled={busy || !preview.changes.length}
            onClick={save}
          >
            {busy ? "Saving…" : `Save ${preview.changes.length} dates`}
          </button>
        ) : (
          <button className="rw-primary" disabled={busy} onClick={review}>
            {busy ? "Loading dates…" : "Review dates"}
          </button>
        )}
      </footer>
    </Dialog>
  );
}
function ShiftTypes({
  types,
  branch,
  repo,
  onSaved,
  onClose,
}: {
  types: ShiftType[];
  branch: string;
  repo: RosterRepository;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [centre, setCentre] = useState(
    branch === "global" ? "calicut" : branch,
  );
  const [value, setValue] = useState<Shift>(plainShift());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setError("");
    try {
      validateShift(value);
      if (!value.shift_label?.trim()) throw Error("Give this shift a name.");
      setBusy(true);
      await repo.createType({
        ...value,
        shift_label: value.shift_label.trim(),
        branch_location: centre,
      });
      onSaved();
      setValue(plainShift());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function archive(id: string) {
    setBusy(true);
    setError("");
    try {
      await repo.archiveType(id);
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Shift types" onClose={() => !busy && onClose()}>
      <p className="rw-muted">
        Save hours once, then select the shift in any roster entry or Quick Add.
        Existing dates keep their saved hours.
      </p>
      {branch === "global" && (
        <label>
          Centre
          <select value={centre} onChange={(e) => setCentre(e.target.value)}>
            <option value="calicut">Calicut</option>
            <option value="cochin">Cochin</option>
          </select>
        </label>
      )}
      <div className="rw-type-list">
        {types
          .filter((t) => t.branch_location === centre)
          .map((t) => (
            <div key={t.id}>
              <span>
                <b>{t.shift_label}</b>
                <small>
                  {timing(t)} · {t.grace_minutes} min grace
                </small>
              </span>
              <button
                className="rw-text"
                disabled={busy}
                onClick={() => archive(t.id)}
              >
                Archive
              </button>
            </div>
          ))}
      </div>
      <fieldset disabled={busy} className="rw-fieldset">
        <h3>Add a shift type</h3>
        <div className="rw-presets">
          <button
            onClick={() =>
              setValue({
                shift_code: "D",
                shift_label: "CMA early",
                shift_start: "06:00",
                shift_end: "15:00",
                grace_minutes: 0,
              })
            }
          >
            6 AM–3 PM
          </button>
          <button
            onClick={() =>
              setValue({
                shift_code: "D",
                shift_label: "CMA late",
                shift_start: "11:30",
                shift_end: "20:30",
                grace_minutes: 0,
              })
            }
          >
            11:30 AM–8:30 PM
          </button>
        </div>
        <ShiftFields requireName value={value} onChange={setValue} types={[]} />
      </fieldset>
      {error && (
        <p className="rw-error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <button onClick={onClose} disabled={busy}>
          Done
        </button>
        <button className="rw-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save shift type"}
        </button>
      </footer>
    </Dialog>
  );
}
export default function RosterWorkspace({
  branch,
  meId,
  canEdit,
  repo = rosterRepository,
  now: initialNow,
}: {
  branch: string;
  meId?: string;
  canEdit: boolean;
  repo?: RosterRepository;
  now?: Date;
}) {
  const [now, setNow] = useState(initialNow || new Date());
  const today = clockParts(now).day;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [tab, setTab] = useState<"schedule" | "attendance">("schedule");
  const [span, setSpan] = useState<"week" | "month">("week");
  const [week, setWeek] = useState(
    Math.floor((Number(today.slice(-2)) - 1) / 7),
  );
  const [data, setData] = useState<Snapshot>(empty);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{
    person: Person;
    date: string;
    existing?: Schedule;
  } | null>(null);
  const [quick, setQuick] = useState(false);
  const [typeDialog, setTypeDialog] = useState(false);
  const [analysis, setAnalysis] = useState<"daily" | "overview">("daily");
  const [day, setDay] = useState(today);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [acting, setActing] = useState(false);
  const days = useMemo(() => monthDays(month), [month]);
  useEffect(() => {
    if (initialNow) return;
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, [initialNow]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    repo
      .load(month)
      .then((value) => {
        if (!cancelled) {
          setData({ ...value, schedules: value.schedules.map(effectiveShift) });
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(errorText(e));
          setLoaded(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, repo, refresh]);
  useEffect(() => {
    const h = () => setRefresh((x) => x + 1);
    window.addEventListener("focus", h);
    window.addEventListener("fets-roster-changed", h);
    const id = setInterval(h, 60000);
    return () => {
      window.removeEventListener("focus", h);
      window.removeEventListener("fets-roster-changed", h);
      clearInterval(id);
    };
  }, []);
  function changeMonth(m: string) {
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    setMonth(m);
    setWeek(
      m === today.slice(0, 7)
        ? Math.floor((Number(today.slice(-2)) - 1) / 7)
        : 0,
    );
    setDay(m === today.slice(0, 7) ? today : m + "-01");
    if (m !== month) setLoaded(false);
    setSelectedStaff("");
  }
  const schedules = useMemo(
    () => new Map(data.schedules.map((s) => [`${s.profile_id}/${s.date}`, s])),
    [data.schedules],
  );
  const attendance = useMemo(
    () => new Map(data.attendance.map((a) => [`${a.staff_id}/${a.date}`, a])),
    [data.attendance],
  );
  const scoped = (s: Schedule | undefined, p: Person) =>
    branch === "global" ||
    String(s?.branch_location || p.branch_assigned).toLowerCase() === branch;
  const people = data.people.filter(
    (p) =>
      p.is_active !== false &&
      isStaffRosterVisible(p, month) &&
      (branch === "global" ||
        p.branch_assigned?.toLowerCase() === branch ||
        data.schedules.some(
          (s) =>
            s.profile_id === p.id &&
            s.branch_location?.toLowerCase() === branch,
        )),
  );
  const visiblePeople = people.filter((p) =>
    p.full_name.toLowerCase().includes(query.toLowerCase()),
  );
  const visibleDays =
    span === "month" ? days : days.slice(week * 7, week * 7 + 7);
  const changed = () => {
    setMessage("Saved to the roster.");
    window.dispatchEvent(new Event("fets-roster-changed"));
  };
  const records = useMemo(
    () =>
      data.people.flatMap((p) =>
        days.flatMap((d) => {
          const key = `${p.id}/${d}`,
            s = schedules.get(key),
            a = attendance.get(key);
          if (!s && !a) return [];
          const centre = String(
            s?.branch_location || a?.branch_location || p.branch_assigned,
          ).toLowerCase();
          if (branch !== "global" && centre !== branch) return [];
          return [
            {
              person: p,
              date: d,
              schedule: s,
              attendance: a,
              centre,
              metrics: attendanceMetrics(a, s, d, now),
            },
          ];
        }),
      ),
    [data, days, schedules, attendance, branch, now],
  );
  const relevant = records.filter(
    (r) =>
      r.date <= today &&
      r.person.full_name.toLowerCase().includes(query.toLowerCase()),
  );
  const comparable = relevant.filter((r) => r.metrics.comparable),
    late = comparable.filter((r) => (r.metrics.late || 0) > 0),
    early = relevant.filter((r) => (r.metrics.early || 0) > 0),
    missing = relevant.filter(
      (r) => r.metrics.missingIn || r.metrics.missingOut || r.metrics.invalid,
    );
  const summary = data.people
    .map((p) => {
      const rows = relevant.filter((r) => r.person.id === p.id);
      return {
        p,
        rows,
        scheduled: rows.filter((r) => r.metrics.scheduled).length,
        present: rows.filter((r) => r.metrics.present).length,
        compared: rows.filter((r) => r.metrics.comparable).length,
        late: rows.filter((r) => (r.metrics.late || 0) > 0).length,
        lateMins: rows.reduce((sum, r) => sum + (r.metrics.late || 0), 0),
        early: rows.filter((r) => (r.metrics.early || 0) > 0).length,
        earlyMins: rows.reduce((sum, r) => sum + (r.metrics.early || 0), 0),
        missing: rows.filter(
          (r) =>
            r.metrics.missingOut || r.metrics.missingIn || r.metrics.invalid,
        ).length,
        outsideKnown: rows.filter((r) => r.metrics.outside !== null).length,
        workedKnown: rows.filter(
          (r) => r.metrics.complete && r.metrics.worked !== null,
        ).length,
        outside: rows.reduce((sum, r) => sum + (r.metrics.outside || 0), 0),
        approved: rows.reduce(
          (sum, r) => sum + (r.schedule?.overtime_hours || 0),
          0,
        ),
        worked: rows.reduce(
          (sum, r) => sum + (r.metrics.complete ? r.metrics.worked || 0 : 0),
          0,
        ),
      };
    })
    .filter((x) => x.rows.length)
    .sort((a, b) => a.p.full_name.localeCompare(b.p.full_name));
  const issue = (r: (typeof records)[number]) =>
    r.metrics.missingIn ||
    r.metrics.missingOut ||
    r.metrics.invalid ||
    (r.metrics.late || 0) > 0 ||
    (r.metrics.early || 0) > 0;
  const detail = records
    .filter(
      (r) =>
        (selectedStaff ? r.person.id === selectedStaff : r.date === day) &&
        r.person.full_name.toLowerCase().includes(query.toLowerCase()) &&
        (!onlyIssues || issue(r)),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.person.full_name.localeCompare(b.person.full_name),
    );
  const mine = data.attendance.find(
    (r) => r.staff_id === meId && r.date === today,
  );
  let onBreak = false;
  try {
    const steps = JSON.parse(mine?.notes || "{}").steps || [];
    onBreak = !!(steps.at(-1)?.out && !steps.at(-1)?.in);
  } catch {
    /* invalid notes are shown by server */
  }
  async function act(action: "in" | "out" | "break" | "back") {
    setActing(true);
    setMessage("");
    try {
      await repo.attendance(action);
      setRefresh((x) => x + 1);
      window.dispatchEvent(new Event("fets-roster-changed"));
      setMessage("Attendance saved.");
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setActing(false);
    }
  }
  function exportLog() {
    const rows = [
      [
        "Date",
        "Staff",
        "Centre",
        "Roster type",
        "Scheduled start",
        "Scheduled end",
        "Grace minutes",
        "Check in",
        "Check out",
        "Status",
        "Late minutes",
        "Early departure minutes",
        "Break minutes",
        "Net minutes",
        "Hours state",
        "Outside schedule minutes",
        "Approved overtime hours",
      ],
      ...records.map((r) => [
        r.date,
        r.person.full_name,
        r.centre,
        r.schedule ? shiftName(r.schedule) : "Not scheduled",
        r.schedule?.shift_start,
        r.schedule?.shift_end,
        r.schedule?.grace_minutes,
        r.attendance?.check_in,
        r.attendance?.check_out,
        r.metrics.status,
        r.metrics.late,
        r.metrics.early,
        r.metrics.breaks,
        r.metrics.worked,
        r.metrics.complete
          ? "Completed"
          : r.metrics.active
            ? "Live estimate"
            : "Incomplete / unavailable",
        r.metrics.outside,
        r.schedule?.overtime_hours || 0,
      ]),
    ];
    const blob = new Blob(
      ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `FETS-attendance-${branch}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const notesFor = (r: (typeof records)[number]) => (
    <>
      {r.metrics.late !== null ? (
        <span className={r.metrics.late ? "rw-warn" : "rw-good"}>
          {r.metrics.late ? `${r.metrics.late}m late` : "On time"}
        </span>
      ) : (
        <span className="rw-muted">
          {r.metrics.present ? "No scheduled timing" : "—"}
        </span>
      )}
      {r.metrics.early !== null && r.metrics.early > 0 && (
        <span className="rw-warn">{r.metrics.early}m early departure</span>
      )}
    </>
  );
  return (
    <div className="rw" aria-label="Roster workspace">
      <header className="rw-header">
        <div>
          <span className="rw-eyebrow">
            {branchName(branch)} · STAFF SCHEDULE
          </span>
          <h1>Roster</h1>
        </div>
        <div className="rw-header-actions">
          {canEdit && (
            <>
              <button
                disabled={!loaded || loading}
                onClick={() => setTypeDialog(true)}
              >
                <SlidersHorizontal size={16} />
                Shift types
              </button>
              <button
                disabled={!loaded || loading || !people.length}
                className="rw-primary"
                onClick={() => setQuick(true)}
              >
                <Plus size={17} />
                Quick Add
              </button>
            </>
          )}
        </div>
      </header>
      <div className="rw-toolbar">
        <nav aria-label="Roster views">
          <button
            aria-current={tab === "schedule" ? "page" : undefined}
            onClick={() => setTab("schedule")}
          >
            Schedule
          </button>
          <button
            aria-current={tab === "attendance" ? "page" : undefined}
            onClick={() => setTab("attendance")}
          >
            Attendance
          </button>
        </nav>
        <div className="rw-period">
          <button
            className="rw-icon"
            aria-label="Previous month"
            onClick={() => changeMonth(addDays(month + "-01", -1).slice(0, 7))}
          >
            <ChevronLeft size={18} />
          </button>
          <label className="rw-sr" htmlFor="rw-month">
            Roster month
          </label>
          <input
            id="rw-month"
            type="month"
            value={month}
            onChange={(e) => changeMonth(e.target.value)}
          />
          <button
            className="rw-icon"
            aria-label="Next month"
            onClick={() =>
              changeMonth(addDays(days[days.length - 1], 1).slice(0, 7))
            }
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="rw-text"
            onClick={() => {
              changeMonth(today.slice(0, 7));
              setDay(today);
            }}
          >
            Today
          </button>
          <button
            className="rw-icon"
            aria-label="Refresh roster"
            disabled={loading}
            onClick={() => setRefresh((x) => x + 1)}
          >
            <RefreshCw size={16} className={loading ? "rw-spin" : ""} />
          </button>
        </div>
      </div>
      {message && (
        <div className="rw-notice" role="status">
          {message}
          <button
            className="rw-icon"
            aria-label="Dismiss message"
            onClick={() => setMessage("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {error && (
        <div className="rw-error" role="alert">
          {error}
          <button onClick={() => setRefresh((x) => x + 1)}>Try again</button>
        </div>
      )}
      {!loaded || loading ? (
        <div className="rw-empty" role="status">
          {error
            ? "Roster unavailable. Nothing has been changed."
            : "Loading roster and attendance…"}
        </div>
      ) : (
        <>
          <div className="rw-subtoolbar">
            <label className="rw-search">
              <span className="rw-sr">Search staff</span>
              <input
                placeholder="Search staff"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {tab === "schedule" ? (
              <>
                <div className="rw-segment" aria-label="Schedule range">
                  <button
                    aria-pressed={span === "week"}
                    onClick={() => setSpan("week")}
                  >
                    Week
                  </button>
                  <button
                    aria-pressed={span === "month"}
                    onClick={() => setSpan("month")}
                  >
                    Month
                  </button>
                </div>
                {span === "week" && (
                  <div className="rw-week-nav">
                    <button
                      className="rw-icon"
                      aria-label="Previous week"
                      disabled={week === 0}
                      onClick={() => setWeek((w) => w - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span>
                      {prettyDate(visibleDays[0])}–
                      {prettyDate(visibleDays[visibleDays.length - 1])}
                    </span>
                    <button
                      className="rw-icon"
                      aria-label="Next week"
                      disabled={(week + 1) * 7 >= days.length}
                      onClick={() => setWeek((w) => w + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rw-segment">
                  <button
                    aria-pressed={analysis === "daily"}
                    onClick={() => {
                      setAnalysis("daily");
                      setSelectedStaff("");
                    }}
                  >
                    Daily log
                  </button>
                  <button
                    aria-pressed={analysis === "overview"}
                    onClick={() => {
                      setAnalysis("overview");
                      setSelectedStaff("");
                    }}
                  >
                    Monthly overview
                  </button>
                </div>
                <button onClick={exportLog}>
                  <Download size={15} />
                  Export log
                </button>
              </>
            )}
          </div>
          {tab === "schedule" ? (
            <>
              <div
                className={`rw-grid-wrap ${span}`}
                tabIndex={0}
                aria-label="Staff schedule; scroll to see more dates"
              >
                <table className="rw-grid">
                  <thead>
                    <tr>
                      <th scope="col">Staff member</th>
                      {visibleDays.map((d) => (
                        <th
                          key={d}
                          scope="col"
                          className={d === today ? "today" : ""}
                        >
                          <span>
                            {new Date(d + "T12:00:00Z").toLocaleDateString(
                              "en-IN",
                              { weekday: "short" },
                            )}
                          </span>
                          <strong>{Number(d.slice(-2))}</strong>
                          {d === today && <small>Today</small>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePeople.map((p) => (
                      <tr key={p.id}>
                        <th scope="row">
                          <span className="rw-avatar">
                            {p.full_name
                              .split(" ")
                              .map((x) => x[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <span>
                            {p.full_name}
                            <small>
                              {branchName(p.branch_assigned?.toLowerCase())}
                              {p.id === meId ? " · You" : ""}
                            </small>
                          </span>
                        </th>
                        {visibleDays.map((d) => {
                          const s = schedules.get(`${p.id}/${d}`);
                          const here = scoped(s, p);
                          return (
                            <td key={d} className={d === today ? "today" : ""}>
                              <button
                                disabled={!canEdit || !here}
                                className={`rw-cell ${s ? (WORK_CODES.has(s.shift_code) ? "work" : s.shift_code === "L" ? "leave" : "rest") : "empty"}`}
                                aria-label={`${p.full_name}, ${prettyDate(d)}, ${s ? shiftName(s) + " " + timing(s) : "Not scheduled"}`}
                                onClick={() =>
                                  setEditing({
                                    person: p,
                                    date: d,
                                    existing: s,
                                  })
                                }
                              >
                                {s ? (
                                  <>
                                    <span>{s.shift_label || s.shift_code}</span>
                                    {WORK_CODES.has(s.shift_code) ? (
                                      <small>
                                        {s.shift_start && s.shift_end ? (
                                          <>
                                            {formatTime(s.shift_start)}
                                            <br />
                                            {formatTime(s.shift_end)}
                                          </>
                                        ) : (
                                          "Set times"
                                        )}
                                      </small>
                                    ) : (
                                      <small>
                                        {CODES[
                                          s.shift_code as keyof typeof CODES
                                        ] || s.shift_code}
                                      </small>
                                    )}
                                    {!here && (
                                      <small>
                                        {branchName(s.branch_location)}
                                      </small>
                                    )}
                                    {s.overtime_hours > 0 && (
                                      <em>+{s.overtime_hours}h OT</em>
                                    )}
                                  </>
                                ) : (
                                  <span>—</span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visiblePeople.length && (
                  <div className="rw-empty">No staff match this view.</div>
                )}
              </div>
              <div className="rw-footnote">
                <span>
                  <i className="rw-dot" />
                  Work <i className="rw-dot leave" />
                  Leave <i className="rw-dot rest" />
                  Rest / TOIL / holiday
                </span>
                <span>
                  {canEdit
                    ? "Select an entry to change its shift and hours."
                    : "Times are in India Standard Time."}
                </span>
              </div>
            </>
          ) : (
            <>
              {meId && month === today.slice(0, 7) && (
                <div className="rw-my-attendance">
                  <span>
                    <Clock3 size={16} />
                    <b>My attendance · today</b>
                    {mine?.check_in && (
                      <small>
                        {formatTime(mine.check_in)}
                        {mine.check_out
                          ? ` – ${formatTime(mine.check_out)}`
                          : onBreak
                            ? " · On break"
                            : " · Checked in"}
                      </small>
                    )}
                  </span>
                  <div>
                    {!mine?.check_in ? (
                      <button
                        disabled={acting}
                        className="rw-primary"
                        onClick={() => act("in")}
                      >
                        Check in
                      </button>
                    ) : !mine.check_out ? (
                      <>
                        <button
                          disabled={acting}
                          onClick={() => act(onBreak ? "back" : "break")}
                        >
                          {onBreak ? "Return from break" : "Start break"}
                        </button>
                        <button
                          disabled={acting}
                          className="rw-primary"
                          onClick={() => act("out")}
                        >
                          Check out
                        </button>
                      </>
                    ) : (
                      <span className="rw-good">
                        <Check size={15} />
                        Checked out
                      </span>
                    )}
                  </div>
                </div>
              )}
              <section
                className="rw-attendance"
                aria-label="Attendance analysis"
              >
                {analysis === "overview" && !selectedStaff ? (
                  <>
                    <div className="rw-analysis-heading">
                      <div>
                        <h2>Attendance overview</h2>
                        <p>
                          Through{" "}
                          {prettyDate(
                            month === today.slice(0, 7)
                              ? today
                              : days[days.length - 1],
                          )}{" "}
                          · based on each person’s rostered hours
                        </p>
                      </div>
                    </div>
                    <div className="rw-measures">
                      <div>
                        <span>On-time arrivals</span>
                        <strong>
                          {comparable.length
                            ? `${comparable.length - late.length}/${comparable.length}`
                            : "—"}
                        </strong>
                        <small>Only arrivals with saved shift times</small>
                      </div>
                      <div>
                        <span>Late arrivals</span>
                        <strong>{late.length}</strong>
                        <small>
                          {late.reduce((s, r) => s + (r.metrics.late || 0), 0)}{" "}
                          minutes after grace
                        </small>
                      </div>
                      <div>
                        <span>Early departures</span>
                        <strong>{early.length}</strong>
                        <small>Before the rostered end time</small>
                      </div>
                      <div>
                        <span>Records to review</span>
                        <strong>{missing.length}</strong>
                        <small>
                          Missing check-ins, check-outs or invalid times
                        </small>
                      </div>
                    </div>
                    <div className="rw-table-wrap">
                      <table className="rw-review">
                        <thead>
                          <tr>
                            <th>Staff</th>
                            <th>Scheduled*</th>
                            <th>Checked in</th>
                            <th>On time</th>
                            <th>Late</th>
                            <th>Left early</th>
                            <th>Review</th>
                            <th>Completed hours</th>
                            <th>Outside hours</th>
                            <th>Approved OT</th>
                            <th>
                              <span className="rw-sr">View daily detail</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.map((s) => (
                            <tr key={s.p.id}>
                              <th scope="row">{s.p.full_name}</th>
                              <td>{s.scheduled}</td>
                              <td>{s.present}</td>
                              <td>
                                {s.compared
                                  ? `${s.compared - s.late}/${s.compared}`
                                  : "—"}
                              </td>
                              <td className={s.late ? "rw-warn" : ""}>
                                {s.late}
                                <small>
                                  {s.lateMins ? `${s.lateMins} min` : ""}
                                </small>
                              </td>
                              <td className={s.early ? "rw-warn" : ""}>
                                {s.early}
                                <small>
                                  {s.earlyMins ? `${s.earlyMins} min` : ""}
                                </small>
                              </td>
                              <td>{s.missing || "—"}</td>
                              <td>
                                {s.workedKnown ? duration(s.worked) : "—"}
                                <small>{s.workedKnown} complete records</small>
                              </td>
                              <td>
                                {s.outsideKnown ? duration(s.outside) : "—"}
                                <small>{s.outsideKnown} assessed records</small>
                              </td>
                              <td>{duration(Math.round(s.approved * 60))}</td>
                              <td>
                                <button
                                  className="rw-icon"
                                  aria-label={`View ${s.p.full_name} attendance`}
                                  onClick={() => setSelectedStaff(s.p.id)}
                                >
                                  <ArrowUpRight size={17} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!summary.length && (
                        <div className="rw-empty">
                          No attendance or roster entries in this period.
                        </div>
                      )}
                    </div>
                    <p className="rw-method">
                      *Scheduled days through today. On time = checked in by the
                      scheduled start plus saved grace. Completed hours exclude
                      breaks, ongoing shifts and missing check-outs. Timing not
                      set is excluded from punctuality, never treated as on
                      time. Missing check-in is a record to review, not a
                      confirmed absence. Outside hours exclude recorded breaks
                      and are not automatically approved overtime. Totals
                      include only assessed records; a dash means no usable
                      records. Approved OT is the company-approved amount saved
                      on the roster.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="rw-analysis-heading">
                      <div>
                        <h2>
                          {selectedStaff
                            ? data.people.find((p) => p.id === selectedStaff)
                                ?.full_name
                            : "Daily attendance"}
                        </h2>
                        <p>
                          Scheduled hours beside actual check-in and check-out
                        </p>
                      </div>
                      {selectedStaff ? (
                        <button onClick={() => setSelectedStaff("")}>
                          <ChevronLeft size={15} />
                          Back to overview
                        </button>
                      ) : (
                        <label className="rw-inline">
                          Date
                          <input
                            type="date"
                            min={days[0]}
                            max={days[days.length - 1]}
                            value={day}
                            onChange={(e) => setDay(e.target.value)}
                          />
                        </label>
                      )}
                    </div>
                    <label className="rw-check rw-issues">
                      <input
                        type="checkbox"
                        checked={onlyIssues}
                        onChange={(e) => setOnlyIssues(e.target.checked)}
                      />
                      Show only records needing attention
                    </label>
                    <div className="rw-table-wrap">
                      <table className="rw-detail">
                        <thead>
                          <tr>
                            <th>{selectedStaff ? "Date" : "Staff"}</th>
                            <th>Scheduled</th>
                            <th>Check-in</th>
                            <th>Check-out</th>
                            <th>Punctuality</th>
                            <th>Net hours</th>
                            <th>Outside hours / approved OT</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.map((r) => (
                            <tr key={`${r.person.id}/${r.date}`}>
                              <th scope="row">
                                {selectedStaff
                                  ? prettyDate(r.date)
                                  : r.person.full_name}
                                {!selectedStaff && (
                                  <small>{branchName(r.centre)}</small>
                                )}
                              </th>
                              <td>
                                {r.schedule
                                  ? shiftName(r.schedule)
                                  : "Not scheduled"}
                                <small>
                                  {timing(r.schedule)}
                                  {r.schedule?.grace_minutes
                                    ? ` · ${r.schedule.grace_minutes}m grace`
                                    : ""}
                                </small>
                              </td>
                              <td>{formatTime(r.attendance?.check_in)}</td>
                              <td>{formatTime(r.attendance?.check_out)}</td>
                              <td className="rw-punctuality">{notesFor(r)}</td>
                              <td>
                                {duration(r.metrics.worked)}
                                <small>
                                  {r.metrics.active
                                    ? "Live estimate"
                                    : r.metrics.complete
                                      ? `${r.metrics.breaks}m break`
                                      : ""}
                                </small>
                              </td>
                              <td>
                                {duration(r.metrics.outside)}
                                <small>
                                  {duration(
                                    Math.round(
                                      (r.schedule?.overtime_hours || 0) * 60,
                                    ),
                                  )}{" "}
                                  approved OT
                                </small>
                              </td>
                              <td>
                                <span
                                  className={`rw-status ${r.metrics.missingIn || r.metrics.missingOut || r.metrics.invalid ? "attention" : ""}`}
                                >
                                  {r.metrics.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!detail.length && (
                        <div className="rw-empty">
                          No entries match this date or filter.
                        </div>
                      )}
                    </div>
                    <p className="rw-method">
                      All times are IST. Normal day shifts use 8 AM–5 PM.
                      Entries with unknown hours show “No scheduled timing”.
                      Missing check-outs have no calculated hours until
                      corrected.
                    </p>
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}
      {editing && (
        <EditEntry
          {...editing}
          branch={
            branch === "global"
              ? editing.person.branch_assigned.toLowerCase()
              : branch
          }
          types={data.types.filter(
            (t) =>
              t.branch_location ===
              (editing.existing?.branch_location ||
                (branch === "global"
                  ? editing.person.branch_assigned.toLowerCase()
                  : branch)),
          )}
          repo={repo}
          onSaved={changed}
          onClose={() => setEditing(null)}
        />
      )}
      {quick && (
        <QuickAdd
          people={people}
          types={data.types}
          branch={branch}
          repo={repo}
          onSaved={changed}
          onClose={() => setQuick(false)}
        />
      )}
      {typeDialog && (
        <ShiftTypes
          types={data.types}
          branch={branch}
          repo={repo}
          onSaved={changed}
          onClose={() => setTypeDialog(false)}
        />
      )}
    </div>
  );
}
