import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveInstitute, recordCall, saveBatch, updateFollowup } from "./api";
import { STAGES, OUTCOMES, FOLLOWUP_KINDS, CONCERNS, INTERESTS } from "./model";
import { dueInIST, localIST } from "../redesign/institution-workflow";
import type {
  BatchInput,
  CallInput,
  ContactPermission,
  InstituteInput,
  MockBatch,
  OutreachAnswers,
  OutreachContext,
  OutreachFollowup,
  OutreachInstitute,
  OutreachStage,
} from "./types";

const PERMISSIONS = {
  not_asked: "Not yet asked",
  allowed: "Follow-up allowed",
  do_not_contact: "Do not contact",
};
export const CENTRES = {
  calicut: "Calicut",
  cochin: "Cochin",
  undecided: "To be discussed",
};
function options(values: Record<string, string>) {
  return Object.entries(values).map(([key, label]) => (
    <option key={key} value={key}>
      {label}
    </option>
  ));
}
function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`po-field${wide ? " po-wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function useSave(onSaved: (receipt: unknown) => void) {
  const client = useQueryClient(),
    alive = useRef(true),
    busy = useRef(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run(task: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const receipt = await task();
      void client.invalidateQueries({ queryKey: ["outreach"] });
      if (alive.current) onSaved(receipt);
    } catch (reason) {
      if (alive.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to save. Refresh and try again."
        );
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  return { pending, error, setError, run };
}
function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="po-error" role="alert">
      {message}
    </p>
  ) : null;
}
function SourceNotice({
  stale,
  onReload,
}: {
  stale: boolean;
  onReload?: () => void;
}) {
  return stale ? (
    <div className="po-notice" role="alert">
      <p>
        This institute changed while you were drafting. Your draft is preserved.
        Review the latest details before saving.
      </p>
      {onReload && (
        <button type="button" className="po-secondary" onClick={onReload}>
          Reload current details
        </button>
      )}
    </div>
  ) : null;
}

export function InstituteEditor({
  context,
  institute: currentInstitute,
  onSaved,
  onReload,
}: {
  context: OutreachContext;
  institute?: OutreachInstitute;
  onSaved: () => void;
  onReload?: () => void;
}) {
  const institute = useRef(currentInstitute).current;
  const stale = currentInstitute?.updated_at !== institute?.updated_at;
  const save = useSave(onSaved),
    [permission, setPermission] = useState<ContactPermission>(
      institute?.contact_permission ?? "not_asked"
    );
  const [stage, setStage] = useState<OutreachStage>(institute?.stage ?? "new"),
    [owner, setOwner] = useState(
      institute?.owner_user_id ?? context.viewer.user_id
    );
  const [contact, setContact] = useState({
    phone: institute?.phone ?? "",
    email: institute?.email ?? "",
  });
  const duplicates = context.institutes.filter(
    (item) =>
      item.id !== institute?.id &&
      ((contact.phone &&
        item.phone.replace(/\D/g, "") === contact.phone.replace(/\D/g, "")) ||
        (contact.email &&
          item.email.toLowerCase() === contact.email.toLowerCase()))
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stale) return;
    const form = new FormData(event.currentTarget);
    save.setError("");
    if (!text(form, "name") || !text(form, "city"))
      return save.setError("Enter the institute name and city.");
    if (!text(form, "phone") && !text(form, "email"))
      return save.setError(
        "Add a business phone or email so the owner can follow up."
      );
    if (
      (stage === "paused" ||
        stage === "closed" ||
        (permission !== institute?.contact_permission &&
          (institute?.contact_permission === "do_not_contact" ||
            permission === "do_not_contact")) ||
        (owner !== institute?.owner_user_id && institute)) &&
      !text(form, "change_reason")
    )
      return save.setError(
        "Add a reason for this stage, permission or ownership change."
      );
    if (duplicates.length && !form.get("distinct"))
      return save.setError(
        "Review the matching business contact and confirm this is a distinct institute."
      );
    const input: InstituteInput = {
      id: institute?.id ?? null,
      expected_updated_at: institute?.updated_at ?? null,
      name: text(form, "name"),
      city: text(form, "city"),
      state: text(form, "state"),
      contact_name: text(form, "contact_name"),
      contact_role: text(form, "contact_role"),
      phone: text(form, "phone"),
      email: text(form, "email"),
      website: text(form, "website"),
      preferred_centre: text(
        form,
        "centre"
      ) as InstituteInput["preferred_centre"],
      owner_user_id: context.viewer.can_manage
        ? owner
        : institute?.owner_user_id ?? context.viewer.user_id,
      stage,
      contact_permission: permission,
      notes: text(form, "notes"),
      change_reason: text(form, "change_reason"),
    };
    await save.run(() => saveInstitute(input));
  }
  return (
    <form className="po-form" onSubmit={submit} noValidate>
      <p className="po-help po-wide">
        Record institute business contacts. Keep student names, phone numbers
        and contact lists out of this workspace.
      </p>
      <fieldset disabled={save.pending} className="po-fieldset">
        <Field label="Institute name">
          <input name="name" defaultValue={institute?.name} maxLength={200} />
        </Field>
        <Field label="City">
          <input name="city" defaultValue={institute?.city} maxLength={120} />
        </Field>
        <Field label="State">
          <input
            name="state"
            defaultValue={institute?.state ?? "Kerala"}
            maxLength={120}
          />
        </Field>
        <Field label="Preferred FETS centre">
          <select
            name="centre"
            defaultValue={institute?.preferred_centre ?? "undecided"}
          >
            {options(CENTRES)}
          </select>
        </Field>
        <Field label="Business contact">
          <input
            name="contact_name"
            defaultValue={institute?.contact_name}
            maxLength={160}
          />
        </Field>
        <Field label="Contact role">
          <input
            name="contact_role"
            defaultValue={institute?.contact_role}
            maxLength={120}
          />
        </Field>
        <Field label="Business phone">
          <input
            type="tel"
            name="phone"
            value={contact.phone}
            onChange={(e) => setContact({ ...contact, phone: e.target.value })}
            maxLength={80}
          />
        </Field>
        <Field label="Business email">
          <input
            type="email"
            name="email"
            value={contact.email}
            onChange={(e) => setContact({ ...contact, email: e.target.value })}
            maxLength={254}
          />
        </Field>
        <Field label="Institute website">
          <input
            name="website"
            defaultValue={institute?.website}
            maxLength={500}
            placeholder="https://"
          />
        </Field>
        <Field label="Owner">
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            disabled={!context.viewer.can_manage}
          >
            {context.staff.map((person) => (
              <option key={person.user_id} value={person.user_id}>
                {person.full_name}
                {person.user_id === context.viewer.user_id ? " (you)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Relationship stage">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as OutreachStage)}
          >
            {options(STAGES)}
          </select>
        </Field>
        <Field label="Contact permission">
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as ContactPermission)}
          >
            {Object.entries(PERMISSIONS).map(([key, label]) => (
              <option
                key={key}
                value={key}
                disabled={
                  institute?.contact_permission === "do_not_contact" &&
                  !context.viewer.can_manage &&
                  key !== "do_not_contact"
                }
              >
                {label}
              </option>
            ))}
          </select>
        </Field>
        {permission === "do_not_contact" && (
          <p className="po-notice po-wide">
            Do not contact closes outbound work and preserves conversation
            history.
          </p>
        )}
        {institute?.contact_permission === "do_not_contact" &&
          !context.viewer.can_manage && (
            <p className="po-help po-wide">
              A manager can restore permission with an explanation. For a new
              inbound permission update, use Log conversation.
            </p>
          )}
        <Field label="Relationship notes" wide>
          <textarea
            name="notes"
            defaultValue={institute?.notes}
            rows={3}
            maxLength={5000}
          />
        </Field>
        <Field label="Reason for change" wide>
          <input
            name="change_reason"
            maxLength={1000}
            placeholder="Required when closing, pausing, reassigning or changing do-not-contact permission"
          />
        </Field>
        {duplicates.length > 0 && (
          <div className="po-notice po-wide">
            <p>
              Matching business contact:{" "}
              {duplicates
                .map((item) => `${item.name}, ${item.city}`)
                .join("; ")}
              .
            </p>
            <label className="po-check">
              <input type="checkbox" name="distinct" />I reviewed this match;
              this is a distinct institute.
            </label>
          </div>
        )}
      </fieldset>
      <SourceNotice stale={stale} onReload={onReload} />
      <ErrorMessage message={save.error} />
      <div className="po-form-actions">
        <button
          className="po-primary"
          type="submit"
          disabled={save.pending || stale}
        >
          {save.pending ? "Saving…" : "Save institute"}
        </button>
      </div>
    </form>
  );
}

const EMPTY_ANSWERS: OutreachAnswers = {
  annual_students: null,
  exam_cycle: "",
  booking_influence: "",
  main_worries: "",
  student_queries: "",
  current_mock_format: "",
  environment_gap: "",
  readiness_needs: "",
  expectations: "",
  improvements: "",
};
const QUESTIONS: Record<
  keyof Omit<OutreachAnswers, "annual_students">,
  string
> = {
  exam_cycle: "Exam cycle / usual months",
  booking_influence: "How the institute helps with exam booking",
  main_worries: "Main concerns before the exam",
  student_queries: "Common student questions (no personal details)",
  current_mock_format: "Current mock practice",
  environment_gap: "Gaps in the current mock environment",
  readiness_needs: "Readiness support needed",
  expectations: "Expectations from FETS",
  improvements: "Suggested improvements",
};
export function CallEditor({
  institute: currentInstitute,
  onSaved,
  onReload,
}: {
  institute: OutreachInstitute;
  onSaved: () => void;
  onReload?: () => void;
}) {
  const institute = useRef(currentInstitute).current,
    stale = currentInstitute.updated_at !== institute.updated_at;
  const save = useSave(onSaved),
    occurred = useRef(localIST(new Date().toISOString()));
  const [channel, setChannel] = useState<CallInput["channel"]>("phone"),
    [outcome, setOutcome] = useState<CallInput["outcome"]>("feedback_received");
  const [permission, setPermission] = useState<ContactPermission>(
      institute.contact_permission
    ),
    [close, setClose] = useState(false),
    [stage, setStage] = useState<OutreachStage>(institute.stage);
  const attempt = useRef<{ key: string; input: CallInput } | null>(null);
  const stopped =
    institute.contact_permission === "do_not_contact" &&
    !(
      (channel === "inbound" && outcome === "permission_update") ||
      (channel === "note" && permission === "do_not_contact")
    );
  const closing =
    close ||
    permission === "do_not_contact" ||
    outcome === "do_not_contact" ||
    stage === "closed" ||
    stage === "paused";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stopped || stale) return;
    save.setError("");
    const form = new FormData(event.currentTarget);
    if (!text(form, "summary"))
      return save.setError("Add a concise conversation summary.");
    if (closing && !text(form, "close_reason"))
      return save.setError(
        "Add a closure reason so the relationship remains clear."
      );
    let due: string | null = null,
      at: string | null = null;
    try {
      at = dueInIST(text(form, "occurred_date"), text(form, "occurred_time"));
      if (!closing)
        due = dueInIST(text(form, "next_date"), text(form, "next_time"));
    } catch (error) {
      return save.setError((error as Error).message);
    }
    if (!at)
      return save.setError("Enter the conversation date and time (IST).");
    if (!closing && (!due || !text(form, "next_title")))
      return save.setError(
        "Add a next step date and time, and describe the agreed action."
      );
    const answers = { ...EMPTY_ANSWERS };
    Object.keys(QUESTIONS).forEach((key) => {
      answers[key] = text(form, key);
    });
    const annual = text(form, "annual_students");
    answers.annual_students = annual ? Number(annual) : null;
    if (
      annual &&
      (!Number.isInteger(answers.annual_students) ||
        Number(annual) < 0 ||
        Number(annual) > 10000)
    )
      return save.setError(
        "Annual student estimate must be a whole number from 0 to 10,000."
      );
    const payload: Omit<CallInput, "request_id"> = {
      institute_id: institute.id,
      expected_updated_at: institute.updated_at,
      occurred_at: at,
      channel,
      outcome,
      contact_name: text(form, "contact_name"),
      contact_role: text(form, "contact_role"),
      summary: text(form, "summary"),
      answers,
      concerns: form.getAll("concerns").map(String),
      interest: text(form, "interest") as CallInput["interest"],
      follow_up_permission:
        outcome === "do_not_contact" ? "do_not_contact" : permission,
      advisory_interest: text(
        form,
        "advisory_interest"
      ) as CallInput["advisory_interest"],
      close_reason: closing ? text(form, "close_reason") : "",
      stage,
      next_step: closing
        ? null
        : {
            kind: text(form, "next_kind") as NonNullable<
              CallInput["next_step"]
            >["kind"],
            title: text(form, "next_title"),
            due_at: due!,
          },
    };
    const key = JSON.stringify(payload);
    if (attempt.current?.key !== key)
      attempt.current = {
        key,
        input: { ...payload, request_id: crypto.randomUUID() },
      };
    await save.run(() => recordCall(attempt.current!.input));
  }
  return (
    <form onSubmit={submit} className="po-form" noValidate>
      <fieldset disabled={save.pending} className="po-fieldset">
        <Field label="Channel">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as CallInput["channel"])}
          >
            {options({
              phone: "Phone",
              meeting: "Meeting",
              email: "Email",
              whatsapp: "WhatsApp",
              inbound: "Inbound contact",
              note: "Internal note",
            })}
          </select>
        </Field>
        <Field label="Outcome">
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as CallInput["outcome"])}
          >
            {options(OUTCOMES)}
          </select>
        </Field>
        <Field label="Conversation date (IST)">
          <input
            name="occurred_date"
            type="date"
            defaultValue={occurred.current.date}
          />
        </Field>
        <Field label="Conversation time (IST)">
          <input
            name="occurred_time"
            type="time"
            defaultValue={occurred.current.time}
          />
        </Field>
        <Field label="Spoke with">
          <input
            name="contact_name"
            defaultValue={institute.contact_name}
            maxLength={160}
          />
        </Field>
        <Field label="Their role">
          <input
            name="contact_role"
            defaultValue={institute.contact_role}
            maxLength={120}
          />
        </Field>
        <Field label="Conversation summary" wide>
          <textarea
            name="summary"
            rows={3}
            maxLength={5000}
            placeholder="What mattered to them, and what was agreed?"
          />
        </Field>
        <Field label="Support interest">
          <select name="interest" defaultValue={institute.interest}>
            {options(INTERESTS)}
          </select>
        </Field>
        <Field label="Permission for follow-up">
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as ContactPermission)}
          >
            {options(PERMISSIONS)}
          </select>
        </Field>
        <details className="po-questionnaire po-wide">
          <summary>Optional research questions and concerns</summary>
          <div className="po-question-grid">
            <p className="po-help po-wide">
              Ask only what fits the conversation. Record themes, never student
              contact details or confidential exam content.
            </p>
            <Field label="Approximate annual CMA students">
              <input
                name="annual_students"
                type="number"
                min={0}
                max={10000}
                step={1}
              />
            </Field>
            <Field label="Advisory-group interest">
              <select name="advisory_interest" defaultValue="not_asked">
                {options({
                  not_asked: "Not asked",
                  yes: "Interested",
                  no: "Not interested",
                })}
              </select>
            </Field>
            {Object.entries(QUESTIONS).map(([key, label]) => (
              <Field key={key} label={label}>
                <textarea name={key} rows={2} maxLength={1500} />
              </Field>
            ))}
            <div className="po-wide">
              <span className="po-field-label">Concerns discussed</span>
              <div className="po-tags">
                {Object.entries(CONCERNS).map(([key, label]) => (
                  <label key={key} className="po-check">
                    <input name="concerns" type="checkbox" value={key} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </details>
        <div className="po-section-heading po-wide">
          <h3>Agree what happens next</h3>
          <p>
            A dated action or a clear close keeps this relationship accountable.
          </p>
        </div>
        <Field label="Resulting stage">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as OutreachStage)}
          >
            {options(STAGES)}
          </select>
        </Field>
        <label className="po-check po-wide">
          <input
            type="checkbox"
            checked={close}
            onChange={(e) => setClose(e.target.checked)}
          />
          Close without a next step
        </label>
        {close &&
          !["closed", "paused"].includes(stage) &&
          permission !== "do_not_contact" &&
          outcome !== "do_not_contact" && (
            <p className="po-notice po-wide">
              This leaves an active relationship without a dated action. It will
              appear in Needs next step. Choose Closed above to close the
              relationship.
            </p>
          )}
        {closing ? (
          <Field label="Closure reason" wide>
            <textarea name="close_reason" rows={2} maxLength={2000} />
          </Field>
        ) : (
          <>
            <Field label="Action type">
              <select name="next_kind" defaultValue="requested_callback">
                {options(FOLLOWUP_KINDS)}
              </select>
            </Field>
            <Field label="Next step">
              <input
                name="next_title"
                maxLength={240}
                placeholder="Agreed action, not a general reminder"
              />
            </Field>
            <Field label="Next step date (IST)">
              <input name="next_date" type="date" />
            </Field>
            <Field label="Next step time (IST)">
              <input name="next_time" type="time" />
            </Field>
          </>
        )}
      </fieldset>
      {stopped && (
        <p className="po-error" role="alert">
          Outbound contact is stopped. Record an inbound permission update or an
          internal note that keeps do-not-contact permission.
        </p>
      )}
      <SourceNotice stale={stale} onReload={onReload} />
      <ErrorMessage message={save.error} />
      <div className="po-form-actions">
        <span className="po-help">
          Saved conversations become read-only history.
        </span>
        <button
          type="submit"
          className="po-primary"
          disabled={save.pending || stopped || stale}
        >
          {save.pending ? "Saving…" : "Save conversation"}
        </button>
      </div>
    </form>
  );
}

export function BatchEditor({
  institute,
  batch: currentBatch,
  onSaved,
  onReload,
}: {
  institute: OutreachInstitute;
  batch?: MockBatch;
  onSaved: () => void;
  onReload?: () => void;
}) {
  const batch = useRef(currentBatch).current,
    stale = currentBatch?.updated_at !== batch?.updated_at;
  const save = useSave(onSaved),
    [delivery, setDelivery] = useState<MockBatch["delivery"]>(
      batch?.delivery ?? "fets_centre"
    ),
    [status, setStatus] = useState<MockBatch["status"]>(
      batch?.status ?? "potential"
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stale) return;
    save.setError("");
    const form = new FormData(event.currentTarget);
    if (!text(form, "name"))
      return save.setError("Give this cohort a batch name.");
    const estimated = Number(text(form, "estimated")),
      confirmed = Number(text(form, "confirmed")),
      attended = Number(text(form, "attended"));
    if (
      [estimated, confirmed, attended].some(
        (n) => !Number.isInteger(n) || n < 0 || n > 10000
      )
    )
      return save.setError(
        "Candidate counts must be whole numbers from 0 to 10,000."
      );
    if (attended > confirmed)
      return save.setError("Attendance cannot exceed confirmed candidates.");
    if (status === "potential" && (confirmed || attended))
      return save.setError("A potential batch can only have an estimate.");
    if (status !== "completed" && attended)
      return save.setError(
        "Record attendance only after a batch is completed."
      );
    const centre = text(form, "centre");
    if (delivery === "fets_centre" && !["calicut", "cochin"].includes(centre))
      return save.setError("Choose the FETS centre for this batch.");
    const input: BatchInput = {
      id: batch?.id ?? null,
      expected_updated_at: batch?.updated_at ?? null,
      institute_id: institute.id,
      name: text(form, "name"),
      delivery,
      centre:
        delivery === "fets_centre" ? (centre as "calicut" | "cochin") : null,
      planned_date: text(form, "date") || null,
      status,
      estimated,
      confirmed,
      attended,
      notes: text(form, "notes"),
    };
    await save.run(() => saveBatch(input));
  }
  return (
    <form onSubmit={submit} className="po-form" noValidate>
      <p className="po-help po-wide">
        One record per cohort. These counts support planning; check Calendar
        before agreeing capacity.
      </p>
      <fieldset className="po-fieldset" disabled={save.pending}>
        <Field label="Batch name">
          <input name="name" defaultValue={batch?.name} maxLength={200} />
        </Field>
        <Field label="Delivery">
          <select
            value={delivery}
            onChange={(e) =>
              setDelivery(e.target.value as MockBatch["delivery"])
            }
          >
            {options({
              fets_centre: "Incoming to a FETS centre",
              institute_platform: "Platform at the institute",
            })}
          </select>
        </Field>
        {delivery === "fets_centre" && (
          <Field label="Batch centre">
            <select
              name="centre"
              defaultValue={
                batch?.centre ??
                (institute.preferred_centre === "undecided"
                  ? ""
                  : institute.preferred_centre)
              }
            >
              <option value="">Choose a centre</option>
              {options({ calicut: "Calicut", cochin: "Cochin" })}
            </select>
          </Field>
        )}
        <Field label="Planned mock date">
          <input
            type="date"
            name="date"
            defaultValue={batch?.planned_date ?? ""}
          />
        </Field>
        <Field label="Batch status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MockBatch["status"])}
          >
            {options({
              potential: "Potential",
              confirmed: "Confirmed",
              completed: "Completed",
              cancelled: "Cancelled",
            })}
          </select>
        </Field>
        <Field label="Estimated candidates">
          <input
            name="estimated"
            type="number"
            min={0}
            max={10000}
            step={1}
            defaultValue={batch?.estimated ?? 0}
          />
        </Field>
        <Field label="Confirmed candidates">
          <input
            name="confirmed"
            type="number"
            min={0}
            max={10000}
            step={1}
            defaultValue={batch?.confirmed ?? 0}
          />
        </Field>
        <Field label="Attended candidates">
          <input
            name="attended"
            type="number"
            min={0}
            max={10000}
            step={1}
            defaultValue={batch?.attended ?? 0}
          />
        </Field>
        <Field label="Batch notes" wide>
          <textarea
            name="notes"
            defaultValue={batch?.notes}
            maxLength={5000}
            rows={2}
          />
        </Field>
      </fieldset>
      <SourceNotice stale={stale} onReload={onReload} />
      <ErrorMessage message={save.error} />
      <div className="po-form-actions">
        <button
          className="po-primary"
          type="submit"
          disabled={save.pending || stale}
        >
          {save.pending ? "Saving…" : "Save batch"}
        </button>
      </div>
    </form>
  );
}

export function FollowupEditor({
  followup: currentFollowup,
  onSaved,
  stopped = false,
  onReload,
}: {
  followup: OutreachFollowup;
  onSaved: () => void;
  stopped?: boolean;
  onReload?: () => void;
}) {
  const source = useRef(currentFollowup),
    previousAccepted = useRef<string | null>(null),
    followup = source.current;
  const stale =
    currentFollowup.updated_at !== followup.updated_at &&
    currentFollowup.updated_at !== previousAccepted.current;
  const blocked = stale || (stopped && followup.kind !== "internal_review");
  const local = localIST(followup.due_at),
    [date, setDate] = useState(local.date),
    [time, setTime] = useState(local.time),
    [note, setNote] = useState("");
  const save = useSave((receipt) => {
    const saved = receipt as OutreachFollowup;
    if (saved?.id === followup.id && saved.updated_at) {
      previousAccepted.current = source.current.updated_at;
      source.current = saved;
    }
    setNote("");
    onSaved();
  });
  async function submit(status: "open" | "done" | "cancelled") {
    if (blocked) return;
    save.setError("");
    if (!note.trim())
      return save.setError("Add a note to explain this follow-up update.");
    let due = followup.due_at;
    try {
      if (status === "open") {
        const value = dueInIST(date, time);
        if (!value) throw new Error("Choose a follow-up date and time (IST).");
        due = value;
      }
    } catch (error) {
      return save.setError((error as Error).message);
    }
    await save.run(() =>
      updateFollowup({
        id: followup.id,
        expected_updated_at: followup.updated_at,
        status,
        due_at: due,
        note: note.trim(),
      })
    );
  }
  return (
    <div className="po-form">
      <fieldset disabled={save.pending || blocked} className="po-fieldset">
        <Field label="Follow-up date (IST)">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Follow-up time (IST)">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
        <Field label="Follow-up note" wide>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
          />
        </Field>
      </fieldset>
      <SourceNotice stale={stale} onReload={onReload} />
      <ErrorMessage message={save.error} />
      <div className="po-form-actions">
        <button
          className="po-secondary"
          disabled={save.pending || blocked}
          onClick={() => submit("open")}
        >
          Reschedule
        </button>
        <button
          className="po-primary"
          disabled={save.pending || blocked}
          onClick={() => submit("done")}
        >
          {save.pending ? "Saving…" : "Mark complete"}
        </button>
      </div>
      <p className="po-help">
        After completion, log a conversation with the next agreed action or
        close the relationship.
      </p>
    </div>
  );
}

export function OutreachDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null),
    titleId = useRef(`outreach-${crypto.randomUUID()}`);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>("button,input,select,textarea")
      ?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      className="po-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="po-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key === "Tab") {
            const items = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary"
              ) ?? []
            );
            const first = items[0],
              last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="po-dialog-heading">
          <h2 id={titleId.current}>{title}</h2>
          <button
            className="po-secondary"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
