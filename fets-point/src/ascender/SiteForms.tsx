import React, { useEffect, useRef, useState } from "react";
import { Plus, Settings2, Trash2, X } from "lucide-react";
import type { CentreData, Repository, Row } from "./repository";
import { answerValue, configuredFields, payload, type Field } from "./forms";
import { CENTRE_NAMES, safeLink } from "./model";
export const sectionNames: Record<string, string> = {
  ascender_centres: "Centre details",
  ascender_rooms: "Rooms & labs",
  ascender_programmes: "Programmes",
  ascender_documents: "Documents",
  compliance_items: "Renewals",
  ascender_deployments: "Mobile deployments",
  ascender_inventory: "General inventory",
};
function Modal({
  title,
  subtitle,
  close,
  children,
  busy = false,
}: {
  title: string;
  subtitle: string;
  close: () => void;
  children: React.ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="am-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <div>
          <small>{subtitle}</small>
          <h2>{title}</h2>
        </div>
        <button
          type="button"
          aria-label="Close form"
          disabled={busy}
          onClick={close}
        >
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Questions({
  table,
  centre,
  data,
  repository,
  saved,
  close,
}: {
  table: string;
  centre: Row;
  data: CentreData;
  repository: Repository;
  saved: () => Promise<void>;
  close: () => void;
}) {
  const all = configuredFields(table, data, centre.id, true),
    [editing, setEditing] = useState<Field | null | undefined>(),
    [label, setLabel] = useState(""),
    [kind, setKind] = useState("text"),
    [choices, setChoices] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const begin = (field: Field | null) => {
    setEditing(field);
    setLabel(field?.label || "");
    setKind(field?.setting?.kind || "text");
    setChoices(field?.setting?.options?.join("\n") || "");
    setError("");
  };
  const persist = async (value: Row, previous?: Row) => {
    setBusy(true);
    setError("");
    try {
      await repository.save(
        "ascender_fields",
        { ...value, centre_id: centre.id, section: table },
        previous,
      );
      await saved();
      setEditing(undefined);
    } catch (e: any) {
      setError(e.message || "The question was not saved.");
    } finally {
      setBusy(false);
    }
  };
  const remove = (field: Field) => {
    const restoring = field.removed;
    if (
      !restoring &&
      !confirm(
        `Remove “${field.label}” from this centre’s form? Saved answers are kept if you restore the question.`,
      )
    )
      return;
    const existing = field.setting;
    void persist(
      {
        field_key: field.key,
        label: field.label,
        kind: existing?.kind || "builtin",
        options: existing?.options || [],
        removed: !restoring,
      },
      existing,
    );
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const key = editing?.key || "q_" + crypto.randomUUID().replace(/-/g, "");
    const type = editing && !editing.custom ? "builtin" : kind;
    void persist(
      {
        field_key: key,
        label: label.trim(),
        kind: type,
        options:
          type === "choice"
            ? [
                ...new Set(
                  choices
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                ),
              ]
            : [],
        removed: editing?.removed || false,
      },
      editing?.setting,
    );
  };
  return (
    <Modal
      title={`Edit questions · ${sectionNames[table]}`}
      subtitle={CENTRE_NAMES[centre.code]}
      close={close}
      busy={busy}
    >
      <p className="am-muted">
        Changes apply to this centre. Every answer is optional. Removing a
        question keeps earlier answers available if restored.
      </p>
      {editing !== undefined ? (
        <form onSubmit={save} className="am-question-edit">
          <label>
            Question
            <input
              aria-label="Question"
              required
              maxLength={160}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          {(!editing || editing.custom) && (
            <>
              <label>
                Answer type
                <select
                  aria-label="Answer type"
                  value={kind}
                  disabled={Boolean(editing)}
                  onChange={(e) => setKind(e.target.value)}
                >
                  {[
                    ["text", "Short text"],
                    ["textarea", "Long text"],
                    ["number", "Number"],
                    ["date", "Date"],
                    ["url", "Web link"],
                    ["email", "Email"],
                    ["checkbox", "Yes / No"],
                    ["choice", "Choice list"],
                  ].map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {kind === "choice" && (
                <label>
                  Choices, one per line
                  <textarea
                    aria-label="Choices, one per line"
                    required
                    value={choices}
                    onChange={(e) => setChoices(e.target.value)}
                  />
                </label>
              )}
            </>
          )}
          <footer>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(undefined)}
            >
              Cancel edit
            </button>
            <button className="am-primary" disabled={busy || !label.trim()}>
              {busy ? "Saving…" : "Save question"}
            </button>
          </footer>
        </form>
      ) : (
        <>
          <button
            className="am-primary"
            disabled={busy}
            onClick={() => begin(null)}
          >
            <Plus size={15} />
            Add question
          </button>
          <div className="am-question-list">
            {all.map((f) => (
              <div
                key={f.key}
                className={f.removed ? "am-question-removed" : ""}
              >
                <div>
                  <strong>{f.label}</strong>
                  <small>
                    {f.removed
                      ? "Removed"
                      : f.custom
                        ? "Custom question"
                        : "Standard question"}{" "}
                    · Optional
                  </small>
                </div>
                <button
                  disabled={busy}
                  onClick={() => begin(f)}
                  aria-label={`Rename ${f.label}`}
                >
                  Rename
                </button>
                <button
                  disabled={busy}
                  onClick={() => remove(f)}
                  aria-label={`${f.removed ? "Restore" : "Remove"} ${f.label}`}
                >
                  {f.removed ? "Restore" : <Trash2 size={16} />}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="am-error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <button disabled={busy} onClick={close}>
          Done
        </button>
      </footer>
    </Modal>
  );
}
export function SiteEditor({
  table,
  row,
  centre,
  data,
  repository,
  saved,
  close,
  configure,
}: {
  table: string;
  row?: Row;
  centre: Row;
  data: CentreData;
  repository: Repository;
  saved: () => Promise<void>;
  close: () => void;
  configure: () => void;
}) {
  const defs = configuredFields(table, data, centre.id),
    [value, setValue] = useState<Row>(() => ({
      ...row,
      ...row?.custom_answers,
    })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (f: Field, v: any) =>
    setValue((previous) => ({ ...previous, [f.key]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = payload(defs, value);
      if (table !== "ascender_centres") next.centre_id = centre.id;
      await repository.save(table, next, row);
      await saved();
      close();
    } catch (e: any) {
      setError(e.message || "Could not save. Your answers are still here.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`${row ? "Edit" : "Add"} ${sectionNames[table].toLowerCase()}`}
      subtitle={CENTRE_NAMES[centre.code]}
      busy={busy}
      close={close}
    >
      <div className="am-form-controls">
        <span>All answers optional</span>
        <button type="button" disabled={busy} onClick={configure}>
          <Settings2 size={15} />
          Edit questions
        </button>
      </div>
      <form onSubmit={save}>
        <div className="am-fields">
          {defs.map((f) => (
            <div
              key={f.key}
              className={
                f.type === "textarea" ? "am-wide am-answer" : "am-answer"
              }
            >
              <div className="am-answer-label">
                <label htmlFor={"answer-" + f.key}>{f.label}</label>
                <button
                  type="button"
                  aria-label={`Clear answer: ${f.label}`}
                  disabled={busy || value[f.key] == null || value[f.key] === ""}
                  onClick={() => change(f, "")}
                >
                  <X size={13} />
                </button>
              </div>
              {f.type === "select" || f.type === "checkbox" ? (
                <select
                  id={"answer-" + f.key}
                  value={String(value[f.key] ?? "")}
                  onChange={(e) => change(f, e.target.value)}
                >
                  <option value="">Not recorded</option>
                  {value[f.key] != null &&
                    value[f.key] !== "" &&
                    !f.options?.some(
                      ([key]) => key === String(value[f.key]),
                    ) && (
                      <option value={String(value[f.key])}>
                        Previous selection
                      </option>
                    )}
                  {f.options?.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  id={"answer-" + f.key}
                  maxLength={10000}
                  value={value[f.key] ?? ""}
                  onChange={(e) => change(f, e.target.value)}
                />
              ) : (
                <input
                  id={"answer-" + f.key}
                  type={f.type || "text"}
                  min={f.min}
                  max={f.max}
                  step={
                    f.type === "number" ? (f.custom ? "any" : 1) : undefined
                  }
                  maxLength={f.type === "url" ? 2000 : 500}
                  list={
                    table === "ascender_inventory" && f.key === "name"
                      ? "inventory-suggestions"
                      : undefined
                  }
                  value={value[f.key] ?? ""}
                  onChange={(e) => change(f, e.target.value)}
                />
              )}
              {f.hint && <small>{f.hint}</small>}
            </div>
          ))}
          {!defs.length && (
            <p>
              No questions in this section. Use Edit questions to add or restore
              one.
            </p>
          )}
        </div>
        <datalist id="inventory-suggestions">
          {["Computers", "AC", "Printers", "Chairs", "Tables", "UPS"].map(
            (name) => (
              <option key={name} value={name} />
            ),
          )}
        </datalist>
        {error && (
          <p className="am-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="am-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function AnswerList({ defs, row }: { defs: Field[]; row: Row }) {
  const answered = defs.filter((f) => {
    const v = answerValue(row, f);
    return v !== null && v !== undefined && v !== "";
  });
  return answered.length ? (
    <dl className="am-answers">
      {answered.map((f) => {
        const value = answerValue(row, f),
          option = f.options?.find(([id]) => id === String(value));
        return (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd>
              {f.type === "url" && safeLink(String(value)) ? (
                <a
                  href={safeLink(String(value))!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {String(value)}
                </a>
              ) : (
                (option?.[1] ??
                (typeof value === "boolean"
                  ? value
                    ? "Yes"
                    : "No"
                  : String(value)))
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  ) : (
    <p className="am-muted">No answers recorded.</p>
  );
}
