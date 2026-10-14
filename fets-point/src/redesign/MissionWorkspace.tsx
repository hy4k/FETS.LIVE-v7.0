import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Flag,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";
import {
  DISTRICTS,
  dueInIST,
  dueLabel,
  localIST,
  PEARSON_REQUIREMENTS_URL,
  STAGE_GUIDE_NOTE,
} from "./institution-workflow";
import "./institution-actionables.css";
import "./actionables-workspace.css";
import ActionablesPortfolio, {
  PORTFOLIO_TABS,
  type PortfolioView,
} from "./ActionablesPortfolio";
import ActionablesReadiness from "./ActionablesReadiness";
import ActionablesSourceBoard, {
  SOURCE_TASK_INSTITUTIONS,
} from "./ActionablesSourceBoard";
import {
  ACTIONABLES_REFERENCE,
  latestSelections,
  selectedIds,
  type ActionablesData,
  type ActionablesIdentity,
  type Criterion,
  type Observation,
  type WorkFilter,
  type WorkItem,
} from "./actionables-model";
import {
  actionablesRepository,
  type ActionablesRepository,
} from "./actionables-repository";

const statuses: Record<string, string> = {
  open: "Not started",
  in_progress: "In progress",
  blocked: "Needs follow-up",
  done: "Completed",
};
const blankInstitute = {
  name: "",
  district: "Kottayam",
  address: "",
  primary_contact_name: "",
  primary_contact_role: "",
  primary_contact_phone: "",
  primary_contact_email: "",
  website: "",
  notes: "",
  lab_seat_capacity: "",
};
const blankDuty = {
  title: "",
  instructions: "",
  owner_id: "",
  institution_stage_id: "",
  due_date: "",
  due_time: "",
  report_to_id: "",
  report_instructions:
    "Update the result here, then inform the reporting person through Team space.",
};
const blankResult = {
  content: "",
  status: "in_progress",
  follow_up_date: "",
  follow_up_time: "",
  reported: false,
};
function errorText(error: any) {
  return error?.message || "The change could not be saved. Please try again.";
}
function safeWebsite(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (
      ref.current?.querySelector<HTMLElement>("input,textarea,select") ||
      ref.current?.querySelector<HTMLElement>("button")
    )?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
          ) || [],
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="ia-overlay">
      <div
        ref={ref}
        className="ia-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="Close dialog" onClick={close}>
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function MissionWorkspace() {
  const { profile, user } = useAuth();
  return (
    <ActionablesWorkspace
      profile={{
        id: profile?.id || "",
        user_id: user?.id || "",
        full_name: profile?.full_name || "Your account",
      }}
    />
  );
}
const emptyData: ActionablesData = {
  institutions: [],
  stages: [],
  tasks: [],
  updates: [],
  staff: [],
  selections: [],
  observations: [],
  extensionsReady: false,
  canManage: false,
  referenceTasks: [],
};
export function ActionablesWorkspace({
  profile,
  repository = actionablesRepository,
}: {
  profile: ActionablesIdentity;
  repository?: ActionablesRepository;
}) {
  const qc = useQueryClient();
  const [view, setView] = useState<PortfolioView>("institutions");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [person, setPerson] = useState("all");
  const [institutionView, setInstitutionView] = useState<"work" | "readiness">(
    "work",
  );
  const [district, setDistrict] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [modal, setModal] = useState<
    | "institution"
    | "duty"
    | "result"
    | "stage"
    | "complete"
    | "observation"
    | null
  >(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [resultTask, setResultTask] = useState<any>(null);
  const [institute, setInstitute] = useState({ ...blankInstitute });
  const [duty, setDuty] = useState({ ...blankDuty });
  const [dutyInstitutionId, setDutyInstitutionId] = useState("");
  const [result, setResult] = useState({ ...blankResult });
  const [stageForm, setStageForm] = useState({
    title: "",
    instructions: "",
    contact_script: "",
  });
  const [completion, setCompletion] = useState("");
  const [referenceTask, setReferenceTask] = useState<number | null>(null);
  const [observation, setObservation] = useState<{
    criterion: Criterion;
    state: string;
    evidence: string;
    source: string;
    previous?: string;
  }>({ criterion: "c1", state: "", evidence: "", source: "" });
  const [observationInstitutionId, setObservationInstitutionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    run: () => Promise<void>;
  } | null>(null);
  const data = useQuery({
    queryKey: ["institution-actionables", profile.user_id],
    queryFn: () => repository.load(),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
  useEffect(
    () =>
      repository.watch(() => {
        void qc.invalidateQueries({ queryKey: ["institution-actionables"] });
      }),
    [qc, repository],
  );
  const loaded = data.data || emptyData;
  const actor = loaded.actor || profile;
  const allStaff = loaded.staff;
  const staff = allStaff.filter((s) => s.is_active !== false);
  const institutions = loaded.institutions,
    stages = loaded.stages,
    tasks = loaded.tasks,
    updates = [...loaded.updates].sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
  const current = institutions.find((i: any) => i.id === institutionId);
  const currentStages = stages
    .filter((s: any) => s.institution_id === institutionId)
    .sort((a, b) => a.position - b.position);
  const currentTasks = tasks.filter(
    (t: any) => t.institution_id === institutionId,
  );
  const selectedStage =
    stageId === "general"
      ? null
      : currentStages.find((s: any) => s.id === stageId) ||
        currentStages.find((s: any) => !s.completed_at) ||
        currentStages[0];
  const visibleTasks = currentTasks.filter((t: any) =>
    selectedStage
      ? t.institution_stage_id === selectedStage.id
      : !t.institution_stage_id,
  );
  const reportName = (id: string) =>
    allStaff.find((s: any) => s.user_id === id)?.full_name ||
    "Reporting person not assigned";
  async function mutate(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      const refreshed = await data.refetch();
      setModal(null);
      setConfirmation(null);
      toast.success(
        refreshed.error ? "Saved. Refresh to see the updated work." : success,
      );
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function chooseInstitute(i: any) {
    setInstitutionId(i.id);
    setDistrict(i.district);
    const key: Record<string, string> = {
      Scouted: "approach",
      "Pitch Sent": "approach",
      Inspected: "agree",
      "MoU Signed": "approval",
      Certified: "handover",
    };
    const own = stages.filter((s) => s.institution_id === i.id);
    setStageId(
      i.actionables_reference && !own.some((s) => s.completed_at)
        ? own.find((s) => s.stage_key === key[i.actionables_reference.status])
            ?.id || null
        : null,
    );
    setOpenTask(null);
    setInstitutionView("work");
  }
  function go(next: PortfolioView, nextFilter?: WorkFilter) {
    setView(next);
    setInstitutionId(null);
    setStageId(null);
    setSearch("");
    setPerson("all");
    setFilter(nextFilter || "all");
    if (next !== "institutions") setDistrict(null);
  }
  function openWork(task: WorkItem) {
    const institution = institutions.find((i) => i.id === task.institution_id);
    if (!institution) return;
    chooseInstitute(institution);
    setStageId(task.institution_stage_id || "general");
    setOpenTask(task.id);
  }
  function institutionForm(i?: any) {
    setEditId(i?.id || null);
    setInstitute(
      i
        ? (Object.fromEntries(
            Object.keys(blankInstitute).map((k) => [
              k,
              i[k] == null ? "" : String(i[k]),
            ]),
          ) as typeof blankInstitute)
        : { ...blankInstitute, district: district || "Kottayam" },
    );
    setModal("institution");
  }
  async function saveInstitution() {
    if (
      !institute.primary_contact_phone.trim() &&
      !institute.primary_contact_email.trim()
    ) {
      toast.error("Add a phone number or email for the contact point.");
      return;
    }
    const values: any = Object.fromEntries(
      Object.entries(institute).map(([k, v]) => [k, v.trim()]),
    );
    values.lab_seat_capacity =
      institute.lab_seat_capacity === ""
        ? null
        : Number(institute.lab_seat_capacity);
    if (
      values.lab_seat_capacity != null &&
      (!Number.isInteger(values.lab_seat_capacity) ||
        values.lab_seat_capacity < 0)
    ) {
      toast.error("Enter a whole number of seats, or leave capacity blank.");
      return;
    }
    if (values.website && !safeWebsite(values.website)) {
      toast.error("Use a full http:// or https:// website address.");
      return;
    }
    await mutate(
      async () => {
        const row = await repository.save(
          "expansion_institutions",
          editId ? values : { ...values, stage: "identified" },
          editId,
        );
        setDistrict(row.district);
        setInstitutionId(row.id);
        setStageId(null);
      },
      editId ? "Institution updated" : "Institution added",
    );
  }
  function dutyForm(task?: any) {
    const local = localIST(task?.due_at);
    setEditId(task?.id || null);
    setReferenceTask(task?.reference_task_key || null);
    setDuty(
      task
        ? {
            title: task.title,
            instructions: task.instructions || task.impact || "",
            owner_id: task.owner_id || "",
            institution_stage_id: task.institution_stage_id || "",
            due_date: local.date || task.due_date || "",
            due_time: local.time,
            report_to_id: task.report_to_id || "",
            report_instructions:
              task.report_instructions || blankDuty.report_instructions,
          }
        : {
            ...blankDuty,
            owner_id: actor.id || "",
            institution_stage_id: selectedStage?.id || "",
          },
    );
    setModal("duty");
  }
  function newProjectTask() {
    setEditId(null);
    setReferenceTask(null);
    setDutyInstitutionId("");
    setDuty({ ...blankDuty, owner_id: actor.id });
    setModal("duty");
  }
  async function saveDuty() {
    await mutate(
      async () => {
        const due_at = dueInIST(duty.due_date, duty.due_time);
        const institution =
          current || institutions.find((i) => i.id === dutyInstitutionId);
        if (!institution)
          throw new Error("Choose an institution for this task.");
        const values = {
          institution_id: institution.id,
          district: institution.district,
          title: duty.title.trim(),
          instructions: duty.instructions.trim(),
          owner_id: duty.owner_id,
          institution_stage_id: duty.institution_stage_id || null,
          due_date: duty.due_date,
          due_at,
          report_to_id: duty.report_to_id,
          report_instructions: duty.report_instructions.trim(),
          ...(referenceTask
            ? {
                reference_task_key: referenceTask,
                ...(!editId
                  ? {
                      status:
                        loaded.referenceTasks.find(
                          (t) => t.id === referenceTask,
                        )?.status === "inprogress"
                          ? "in_progress"
                          : "open",
                    }
                  : {}),
              }
            : {}),
        };
        await repository.save("mission_work_items", values, editId);
        setStageId(duty.institution_stage_id || "general");
      },
      editId ? "Duty updated" : "Duty assigned",
    );
  }
  function resultForm(task: any, update?: any) {
    const local = localIST(update?.follow_up_at);
    setResultTask(
      update
        ? {
            ...task,
            report_to_id: update.report_to_id,
            report_instructions: update.report_method,
          }
        : task,
    );
    setEditId(update?.id || null);
    setResult(
      update
        ? {
            content: update.content,
            status: update.status,
            follow_up_date: local.date || update.follow_up_date || "",
            follow_up_time: local.time,
            reported: update.reported,
          }
        : {
            ...blankResult,
            status: task.status === "open" ? "in_progress" : task.status,
          },
    );
    setModal("result");
  }
  async function saveResult() {
    await mutate(
      async () => {
        const values = {
          work_item_id: resultTask.id,
          content: result.content.trim(),
          status: result.status,
          follow_up_date: result.follow_up_date || null,
          follow_up_at: dueInIST(result.follow_up_date, result.follow_up_time),
          reported: result.reported,
        };
        await repository.save("mission_task_updates", values, editId);
        setOpenTask(resultTask.id);
      },
      editId ? "Result updated" : "Result saved",
    );
  }
  function stageEditor(stage?: any) {
    setEditId(stage?.id || null);
    setStageForm(
      stage
        ? {
            title: stage.title,
            instructions: stage.instructions,
            contact_script: stage.contact_script,
          }
        : { title: "", instructions: "", contact_script: "" },
    );
    setModal("stage");
  }
  async function saveStage() {
    await mutate(
      async () => {
        const values = {
          title: stageForm.title.trim(),
          instructions: stageForm.instructions.trim(),
          contact_script: stageForm.contact_script.trim(),
        };
        if (!current)
          throw new Error("Open an institution before adding a stage.");
        const row = await repository.save(
          "mission_institution_stages",
          editId
            ? values
            : {
                ...values,
                institution_id: current.id,
                position:
                  Math.max(0, ...currentStages.map((s: any) => s.position)) + 1,
              },
          editId,
        );
        setStageId(row.id);
      },
      editId ? "Stage updated" : "Stage added",
    );
  }
  function confirmDelete(
    type: "institution" | "duty" | "result" | "stage",
    row: any,
  ) {
    const texts = {
      institution:
        "This deletes the institution, its stages, duties and result history. This cannot be undone.",
      duty: "This deletes the duty and its result history.",
      result:
        "This deletes this result. The duty status will follow its latest remaining result, or return to Not started.",
      stage:
        "This deletes the stage. Its duties will remain under General follow-ups.",
    };
    setConfirmation({
      title: `Delete ${type}?`,
      text: texts[type],
      run: async () => {
        if (type === "institution") {
          await repository.remove("expansion_institutions", row.id);
          setInstitutionId(null);
          setStageId(null);
        } else {
          const table =
            type === "duty"
              ? "mission_work_items"
              : type === "result"
                ? "mission_task_updates"
                : "mission_institution_stages";
          await repository.remove(table, row.id);
          if (type === "stage") setStageId("general");
        }
      },
    });
  }
  async function completeStage() {
    await mutate(async () => {
      await repository.save(
        "mission_institution_stages",
        {
          completion_note: completion.trim(),
          completed_at: new Date().toISOString(),
        },
        selectedStage!.id,
      );
    }, "Stage result recorded");
  }
  async function selectTarget(i: any, value: boolean) {
    await mutate(
      () =>
        repository.selectTarget(
          i.id,
          value,
          latestSelections(loaded.selections).get(i.id)?.id,
        ),
      value ? "Institution shortlisted" : "Institution removed from shortlist",
    );
  }
  function recordObservation(
    criterion: Criterion,
    latest?: Observation,
    institution = current,
  ) {
    setObservationInstitutionId(institution?.id || "");
    setObservation({
      criterion,
      state: "",
      evidence: "",
      source: latest?.source_url || "",
      previous: latest?.id,
    });
    setModal("observation");
  }
  function readinessFollowup(
    o: Observation,
    title: string,
    institution = current,
  ) {
    dutyForm();
    setDutyInstitutionId(institution?.id || "");
    setDuty({
      ...blankDuty,
      title: `Resolve ${title.toLowerCase()} gap`,
      instructions: o.evidence,
      owner_id: actor.id,
      institution_stage_id:
        stages.find(
          (s) =>
            s.institution_id === institution?.id && s.stage_key === "assess",
        )?.id || "",
    });
  }
  function assignSourceTask(key: number) {
    const source = loaded.referenceTasks.find((t) => t.id === key);
    const institution = institutions.find(
      (i) => i.actionables_reference?.id === SOURCE_TASK_INSTITUTIONS[key],
    );
    if (!source || !institution) return;
    chooseInstitute(institution);
    setEditId(null);
    setReferenceTask(key);
    setDuty({
      ...blankDuty,
      title: source.title,
      instructions: `${source.title}. Record the actual outcome and the next follow-up. Project team: ${source.assignee}.`,
      owner_id: actor.id,
      institution_stage_id:
        stages.find(
          (s) =>
            s.institution_id === institution.id &&
            s.stage_key ===
              (
                {
                  1: "approach",
                  2: "assess",
                  3: "setup",
                  4: "assess",
                  5: "agree",
                } as Record<number, string>
              )[key],
        )?.id || "",
    });
    setModal("duty");
  }
  async function saveObservation() {
    const id = current?.id || observationInstitutionId;
    if (!id) return;
    if (observation.source && !safeWebsite(observation.source)) {
      toast.error("Use a full http:// or https:// source address.");
      return;
    }
    await mutate(
      () =>
        repository.observe(
          id,
          observation.criterion,
          observation.state,
          observation.evidence.trim(),
          observation.source.trim(),
          observation.previous,
        ),
      "Observation recorded; earlier evidence retained",
    );
  }
  const close = () => {
    if (!busy) setModal(null);
  };
  if (
    data.error instanceof Error &&
    data.error.message.startsWith("Project access has not")
  ) {
    return (
      <div className="ia-page">
        <h1>Actionables</h1>
        <div className="ia-error" role="alert">
          {data.error.message}{" "}
          <button onClick={() => void data.refetch()}>Try again</button>
        </div>
      </div>
    );
  }
  return (
    <div className="ia-page">
      <header className="aw-page-header">
        <div>
          <h1>Actionables</h1>
          {data.data && (
            <p>
              {institutions.filter((i) => i.actionables_reference).length ||
                institutions.length}{" "}
              institutions
            </p>
          )}
        </div>
        <div className="aw-header-actions">
          {data.data && (
            <button
              className="aw-selection-count"
              onClick={() => go("rollout")}
            >
              {selectedIds(loaded.selections).size} / 7 selected
            </button>
          )}
          <button
            className="aw-icon-button"
            aria-label="Refresh Actionables"
            disabled={data.isFetching}
            onClick={() => void data.refetch()}
          >
            <RefreshCw size={17} />
          </button>
          <button
            className="aw-button secondary"
            aria-label="Add institution"
            onClick={() => institutionForm()}
          >
            <Plus size={16} /> Add institution
          </button>
        </div>
      </header>
      <nav className="aw-navigation" aria-label="Actionables views">
        {PORTFOLIO_TABS.map((t) => (
          <button
            key={t.id}
            aria-pressed={view === t.id && !current}
            onClick={() => go(t.id)}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </nav>
      {data.error && (
        <div className="ia-error" role="alert">
          {data.error instanceof Error &&
          data.error.message.startsWith("Project access has not")
            ? data.error.message
            : data.data
              ? "Could not refresh the workspace. Showing the last loaded records."
              : "Could not load the workspace."}{" "}
          <button onClick={() => void data.refetch()}>Try again</button>
        </div>
      )}
      {data.isLoading && (
        <p className="ia-muted" role="status">
          Loading institutions…
        </p>
      )}
      {!current && !data.isLoading && data.data && view === "followup" && (
        <ActionablesSourceBoard
          data={loaded}
          onAssign={assignSourceTask}
          onResult={resultForm}
          onAdd={newProjectTask}
          identity={actor}
          onOpen={openWork}
        />
      )}
      {!current && !data.isLoading && data.data && (
        <ActionablesPortfolio
          data={loaded}
          identity={actor}
          view={view}
          district={district}
          search={search}
          filter={filter}
          person={person}
          busy={busy}
          setSearch={setSearch}
          setDistrict={setDistrict}
          setPerson={setPerson}
          setFilter={setFilter}
          go={go}
          onOpen={chooseInstitute}
          onWork={openWork}
          onResult={resultForm}
          onAdd={() => institutionForm()}
          onSelect={(i, v) => void selectTarget(i, v)}
          onAudit={(i) => {
            chooseInstitute(i);
            setInstitutionView("readiness");
            setView("audit");
          }}
          onObservation={(i, c, o) => recordObservation(c, o, i)}
          onGap={(i, o, t) => readinessFollowup(o, t, i)}
        />
      )}
      {current && (
        <>
          <button
            className="ia-back"
            onClick={() => {
              setInstitutionId(null);
              setStageId(null);
            }}
          >
            <ArrowLeft size={15} /> {current.district} institutions
          </button>
          <section className="ia-contact">
            <div>
              <span className="ia-eyebrow">{current.district}</span>
              <h2>{current.name}</h2>
              <p className="ia-address">
                {current.address || "Full address not added yet"}
              </p>
              <p>
                <strong>
                  {current.primary_contact_name || "Contact point not added"}
                </strong>
                {current.primary_contact_role
                  ? ` · ${current.primary_contact_role}`
                  : ""}
              </p>
              <div className="ia-contact-links">
                {current.primary_contact_phone && (
                  <span>{current.primary_contact_phone}</span>
                )}
                {current.primary_contact_email && (
                  <a href={`mailto:${current.primary_contact_email}`}>
                    {current.primary_contact_email}
                  </a>
                )}
                {safeWebsite(current.website || "") && (
                  <a
                    href={safeWebsite(current.website)!}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website ↗
                  </a>
                )}
              </div>
              {current.notes && <p className="ia-muted">{current.notes}</p>}
            </div>
            <div className="aw-source-record">
              {current.actionables_reference && (
                <>
                  <span
                    className={`aw-source-status status-${current.actionables_reference.status.toLowerCase().split(" ").join("-")}`}
                  >
                    {current.actionables_reference.status}
                  </span>
                  <span>{current.actionables_reference.type}</span>
                  <span>{current.actionables_reference.capacity}</span>
                  <span>PIN {current.actionables_reference.pincode}</span>
                </>
              )}
            </div>
            <div className="ia-contact-actions">
              {loaded.extensionsReady && (
                <button
                  className={`aw-button ${selectedIds(loaded.selections).has(current.id) ? "secondary" : ""}`}
                  disabled={
                    busy ||
                    !loaded.canManage ||
                    (!selectedIds(loaded.selections).has(current.id) &&
                      selectedIds(loaded.selections).size >= 7)
                  }
                  onClick={() =>
                    void selectTarget(
                      current,
                      !selectedIds(loaded.selections).has(current.id),
                    )
                  }
                >
                  <Flag size={15} />
                  {selectedIds(loaded.selections).has(current.id)
                    ? "Shortlisted · remove"
                    : "Add to shortlist"}
                </button>
              )}
              <button
                className="ia-secondary"
                onClick={() => institutionForm(current)}
              >
                <Pencil size={14} /> Edit details
              </button>
              <button
                className="ia-link ia-danger"
                disabled={Boolean(
                  current.actionables_reference && !loaded.canManage,
                )}
                title={
                  current.actionables_reference && !loaded.canManage
                    ? "Management removes catalogue institutions"
                    : undefined
                }
                onClick={() => confirmDelete("institution", current)}
              >
                <Trash2 size={14} /> Delete institution
              </button>
            </div>
          </section>
          <nav className="aw-institution-nav" aria-label="Institution views">
            <button
              aria-pressed={institutionView === "work"}
              onClick={() => setInstitutionView("work")}
            >
              Work & stages
            </button>
            <button
              aria-pressed={institutionView === "readiness"}
              onClick={() => setInstitutionView("readiness")}
            >
              Readiness & evidence
            </button>
          </nav>
          {institutionView === "readiness" && (
            <ActionablesReadiness
              institution={current}
              data={loaded}
              onRecord={recordObservation}
              onFollowup={readinessFollowup}
            />
          )}
          {institutionView === "work" && (
            <>
              <div className="ia-mobile-stages">
                <label>
                  Stage
                  <select
                    aria-label="Choose stage"
                    value={selectedStage?.id || "general"}
                    onChange={(e) => {
                      setStageId(e.target.value);
                      setOpenTask(null);
                    }}
                  >
                    {currentStages.map((s: any, index: number) => (
                      <option key={s.id} value={s.id}>
                        {index + 1}. {s.title}
                        {s.completed_at ? " ✓" : ""}
                      </option>
                    ))}
                    <option value="general">General follow-ups</option>
                  </select>
                </label>
                <button className="ia-secondary" onClick={() => stageEditor()}>
                  <Plus size={14} /> Add stage
                </button>
              </div>
              <div className="ia-work-layout">
                <aside className="ia-stages">
                  <h3>Stages of work</h3>
                  {currentStages.map((s: any, index: number) => (
                    <button
                      key={s.id}
                      className={selectedStage?.id === s.id ? "active" : ""}
                      onClick={() => {
                        setStageId(s.id);
                        setOpenTask(null);
                      }}
                    >
                      <span className={s.completed_at ? "complete" : ""}>
                        {s.completed_at ? <Check size={14} /> : index + 1}
                      </span>
                      <div>
                        {s.title}
                        <small>
                          {s.completed_at
                            ? "Completed"
                            : `${currentTasks.filter((t: any) => t.institution_stage_id === s.id && t.status !== "done").length} open duties`}
                        </small>
                      </div>
                    </button>
                  ))}
                  <button
                    className={!selectedStage ? "active" : ""}
                    onClick={() => {
                      setStageId("general");
                      setOpenTask(null);
                    }}
                  >
                    <span>+</span>
                    <div>General follow-ups</div>
                  </button>
                  <button
                    className="ia-add-stage"
                    onClick={() => stageEditor()}
                  >
                    <Plus size={14} /> Add a stage
                  </button>
                </aside>
                <section className="ia-work">
                  <div className="ia-stage-heading">
                    <div>
                      <span className="ia-eyebrow">
                        {selectedStage
                          ? `STAGE ${currentStages.findIndex((s: any) => s.id === selectedStage.id) + 1}`
                          : "INSTITUTION WORK"}
                      </span>
                      <h2>{selectedStage?.title || "General follow-ups"}</h2>
                    </div>
                    {selectedStage && (
                      <div className="ia-icon-actions">
                        <button
                          aria-label="Edit stage"
                          onClick={() => stageEditor(selectedStage)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          aria-label="Delete stage"
                          onClick={() => confirmDelete("stage", selectedStage)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedStage && (
                    <details
                      className="ia-guide"
                      key={selectedStage.id}
                      open={visibleTasks.length === 0}
                    >
                      <summary>
                        How to do this stage <ChevronDown size={16} />
                      </summary>
                      <p>
                        {selectedStage.instructions
                          .split("{district}")
                          .join(current.district)}
                      </p>
                      {selectedStage.contact_script && (
                        <div className="ia-script">
                          <strong>Suggested contact script</strong>
                          <p>
                            {selectedStage.contact_script
                              .split("[district]")
                              .join(current.district)}
                          </p>
                        </div>
                      )}
                      <small>
                        {STAGE_GUIDE_NOTE}{" "}
                        <a
                          href={PEARSON_REQUIREMENTS_URL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Pearson VUE guidance ↗
                        </a>
                      </small>
                    </details>
                  )}
                  <div className="ia-duties-heading">
                    <h3>
                      Assigned duties <span>{visibleTasks.length}</span>
                    </h3>
                    <button className="ia-primary" onClick={() => dutyForm()}>
                      <Plus size={15} /> Assign duty
                    </button>
                  </div>
                  {!visibleTasks.length && (
                    <div className="ia-empty">
                      <p>
                        Assign the first duty, choose a staff member and set the
                        due date.
                      </p>
                      <span>
                        The result and follow-up will stay with that duty.
                      </span>
                    </div>
                  )}
                  {visibleTasks.map((task: any) => {
                    const history = updates.filter(
                      (u: any) => u.work_item_id === task.id,
                    );
                    const latest = history[0];
                    return (
                      <article className="ia-duty" key={task.id}>
                        <header>
                          <div>
                            <span
                              className={`ia-status ia-status-${task.status}`}
                            >
                              {statuses[task.status]}
                            </span>
                            <h3>{task.title}</h3>
                          </div>
                          <div className="ia-icon-actions">
                            <button
                              aria-label={`Edit duty ${task.title}`}
                              onClick={() => dutyForm(task)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              aria-label={`Delete duty ${task.title}`}
                              onClick={() => confirmDelete("duty", task)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </header>
                        <div className="ia-duty-meta">
                          <span>
                            <strong>
                              {task.owner?.full_name || "Staff to be assigned"}
                            </strong>
                          </span>
                          <span>
                            Due {dueLabel(task.due_date, task.due_at)}
                          </span>
                        </div>
                        {(task.instructions || task.impact) && (
                          <p className="ia-duty-instructions">
                            {task.instructions || task.impact}
                          </p>
                        )}
                        <div className="ia-report">
                          <strong>
                            Report to: {reportName(task.report_to_id)}
                          </strong>
                          <p>
                            {task.report_instructions ||
                              "Add reporting instructions when editing this duty."}
                          </p>
                        </div>
                        {latest && (
                          <div className="ia-latest">
                            <span>LATEST RESULT</span>
                            <p>{latest.content}</p>
                            {latest.follow_up_date && (
                              <small>
                                Next follow-up:{" "}
                                {dueLabel(
                                  latest.follow_up_date,
                                  latest.follow_up_at,
                                )}
                              </small>
                            )}
                            <small>
                              {latest.reported
                                ? `${reportName(latest.report_to_id)} informed`
                                : "Reporting person not yet marked as informed"}
                            </small>
                          </div>
                        )}
                        <footer>
                          <button
                            className="ia-secondary"
                            onClick={() => resultForm(task)}
                          >
                            Update result
                          </button>
                          <button
                            className="ia-link"
                            aria-expanded={openTask === task.id}
                            onClick={() =>
                              setOpenTask(openTask === task.id ? null : task.id)
                            }
                          >
                            {openTask === task.id
                              ? "Hide history"
                              : `Result history (${history.length})`}
                          </button>
                        </footer>
                        {openTask === task.id && (
                          <div className="ia-history">
                            {!history.length && <p>No results recorded yet.</p>}
                            {history.map((u: any) => (
                              <div key={u.id}>
                                <header>
                                  <strong>
                                    {allStaff.find((p) => p.id === u.author_id)
                                      ?.full_name ||
                                      u.author?.full_name ||
                                      "Staff"}
                                  </strong>
                                  <time>
                                    {new Date(u.created_at).toLocaleString(
                                      "en-IN",
                                      { timeZone: "Asia/Kolkata" },
                                    )}{" "}
                                    IST
                                  </time>
                                  <button
                                    aria-label="Edit result"
                                    onClick={() => resultForm(task, u)}
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    aria-label="Delete result"
                                    onClick={() => confirmDelete("result", u)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </header>
                                <p>{u.content}</p>
                                <small>
                                  {statuses[u.status]}
                                  {u.follow_up_date
                                    ? ` · Follow up ${dueLabel(u.follow_up_date, u.follow_up_at)}`
                                    : ""}
                                  {u.reported
                                    ? ` · ${reportName(u.report_to_id)} informed`
                                    : ""}
                                </small>
                                {u.edited_by !== u.author_id && (
                                  <small>
                                    Last edited by{" "}
                                    {u.editor?.full_name || "staff"}
                                  </small>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                  {selectedStage && (
                    <div className="ia-stage-result">
                      {selectedStage.completed_at ? (
                        <>
                          <span>
                            <Check size={15} /> Stage completed ·{" "}
                            {allStaff.find(
                              (s: any) => s.id === selectedStage.completed_by,
                            )?.full_name || "Staff"}
                          </span>
                          <p>{selectedStage.completion_note}</p>
                          <button
                            className="ia-link"
                            disabled={busy}
                            onClick={() =>
                              void mutate(async () => {
                                await repository.save(
                                  "mission_institution_stages",
                                  { completed_at: null },
                                  selectedStage.id,
                                );
                              }, "Stage reopened")
                            }
                          >
                            Reopen stage
                          </button>
                        </>
                      ) : (
                        <>
                          <p>
                            When the duties are complete, record the stage
                            result before moving on.
                          </p>
                          <button
                            className="ia-secondary"
                            onClick={() => {
                              setCompletion(
                                selectedStage.completion_note || "",
                              );
                              setModal("complete");
                            }}
                          >
                            Record stage completion
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </>
      )}
      {modal === "institution" && (
        <Modal
          title={editId ? "Edit institution" : "Add institution"}
          close={close}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveInstitution();
            }}
          >
            <label>
              Institution name
              <input
                required
                maxLength={300}
                value={institute.name}
                onChange={(e) =>
                  setInstitute({ ...institute, name: e.target.value })
                }
              />
            </label>
            <label>
              District
              <select
                value={institute.district}
                onChange={(e) =>
                  setInstitute({ ...institute, district: e.target.value })
                }
              >
                {DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Full postal address
              <textarea
                required
                maxLength={2000}
                placeholder="Building / road, locality, town, district, state and PIN code"
                value={institute.address}
                onChange={(e) =>
                  setInstitute({ ...institute, address: e.target.value })
                }
              />
            </label>
            <div className="ia-form-row">
              <label>
                Contact person / office
                <input
                  required
                  maxLength={200}
                  placeholder="Name or office to approach"
                  value={institute.primary_contact_name}
                  onChange={(e) =>
                    setInstitute({
                      ...institute,
                      primary_contact_name: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Role / designation
                <input
                  maxLength={200}
                  value={institute.primary_contact_role}
                  onChange={(e) =>
                    setInstitute({
                      ...institute,
                      primary_contact_role: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <div className="ia-form-row">
              <label>
                Phone
                <input
                  type="tel"
                  maxLength={60}
                  value={institute.primary_contact_phone}
                  onChange={(e) =>
                    setInstitute({
                      ...institute,
                      primary_contact_phone: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  maxLength={254}
                  value={institute.primary_contact_email}
                  onChange={(e) =>
                    setInstitute({
                      ...institute,
                      primary_contact_email: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <p className="ia-muted">
              Add at least one phone number or email. An office contact is fine
              until a named person is confirmed.
            </p>
            <label>
              Website / source URL
              <input
                type="url"
                maxLength={2000}
                placeholder="https://"
                value={institute.website}
                onChange={(e) =>
                  setInstitute({ ...institute, website: e.target.value })
                }
              />
            </label>
            <label>
              Recorded lab seats (optional)
              <input
                type="number"
                min="0"
                step="1"
                value={institute.lab_seat_capacity}
                onChange={(e) =>
                  setInstitute({
                    ...institute,
                    lab_seat_capacity: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Useful contact notes
              <textarea
                maxLength={4000}
                placeholder="Best time to call, preferred contact method, or information still to verify"
                value={institute.notes}
                onChange={(e) =>
                  setInstitute({ ...institute, notes: e.target.value })
                }
              />
            </label>
            <button className="ia-primary" disabled={busy}>
              {busy ? "Saving…" : "Save institution"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "duty" && (
        <Modal title={editId ? "Edit duty" : "Assign duty"} close={close}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveDuty();
            }}
          >
            {!current && (
              <label>
                Institution
                <select
                  required
                  value={dutyInstitutionId}
                  onChange={(e) => {
                    setDutyInstitutionId(e.target.value);
                    setDuty({ ...duty, institution_stage_id: "" });
                  }}
                >
                  <option value="">Choose institution</option>
                  {institutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Duty
              <input
                required
                maxLength={2000}
                placeholder="What should be done?"
                value={duty.title}
                onChange={(e) => setDuty({ ...duty, title: e.target.value })}
              />
            </label>
            <label>
              Instructions / expected result
              <textarea
                required
                maxLength={4000}
                value={duty.instructions}
                onChange={(e) =>
                  setDuty({ ...duty, instructions: e.target.value })
                }
              />
            </label>
            <div className="ia-form-row">
              <label>
                Assign to
                <select
                  required
                  value={duty.owner_id}
                  onChange={(e) =>
                    setDuty({ ...duty, owner_id: e.target.value })
                  }
                >
                  <option value="">Choose staff</option>
                  {staff.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Stage
                <select
                  value={duty.institution_stage_id}
                  onChange={(e) =>
                    setDuty({ ...duty, institution_stage_id: e.target.value })
                  }
                >
                  <option value="">General follow-ups</option>
                  {(current
                    ? currentStages
                    : stages.filter(
                        (s) => s.institution_id === dutyInstitutionId,
                      )
                  ).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="ia-form-row">
              <label>
                Due date
                <input
                  type="date"
                  required
                  value={duty.due_date}
                  onChange={(e) =>
                    setDuty({ ...duty, due_date: e.target.value })
                  }
                />
              </label>
              <label>
                Due time (IST, optional)
                <input
                  type="time"
                  value={duty.due_time}
                  onChange={(e) =>
                    setDuty({ ...duty, due_time: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Who should receive the result?
              <select
                required
                value={duty.report_to_id}
                onChange={(e) =>
                  setDuty({ ...duty, report_to_id: e.target.value })
                }
              >
                <option value="">Choose reporting person</option>
                {staff
                  .filter((s: any) => s.user_id)
                  .map((s: any) => (
                    <option key={s.id} value={s.user_id}>
                      {s.full_name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              How to report after updating this page
              <textarea
                required
                maxLength={2000}
                placeholder="Example: update the result here, then send the summary to the project owner in Team space."
                value={duty.report_instructions}
                onChange={(e) =>
                  setDuty({ ...duty, report_instructions: e.target.value })
                }
              />
            </label>
            <button className="ia-primary" disabled={busy}>
              {busy ? "Saving…" : "Save duty"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "result" && resultTask && (
        <Modal title={editId ? "Edit result" : "Update result"} close={close}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveResult();
            }}
          >
            <p className="ia-form-context">{resultTask.title}</p>
            <label>
              Result / what happened
              <textarea
                required
                maxLength={4000}
                placeholder="Outcome, who you spoke to, evidence links and the next action"
                value={result.content}
                onChange={(e) =>
                  setResult({ ...result, content: e.target.value })
                }
              />
            </label>
            <label>
              Duty status
              <select
                value={result.status}
                onChange={(e) =>
                  setResult({ ...result, status: e.target.value })
                }
              >
                {Object.entries(statuses).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="ia-form-row">
              <label>
                Next follow-up date (optional)
                <input
                  type="date"
                  value={result.follow_up_date}
                  onChange={(e) =>
                    setResult({ ...result, follow_up_date: e.target.value })
                  }
                />
              </label>
              <label>
                Follow-up time (IST, optional)
                <input
                  type="time"
                  value={result.follow_up_time}
                  onChange={(e) =>
                    setResult({ ...result, follow_up_time: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="ia-report">
              <strong>
                After saving, report to {reportName(resultTask.report_to_id)}
              </strong>
              <p>
                {resultTask.report_instructions ||
                  "Confirm the reporting method with the task owner."}
              </p>
            </div>
            <label className="ia-checkbox">
              <input
                type="checkbox"
                checked={result.reported}
                onChange={(e) =>
                  setResult({ ...result, reported: e.target.checked })
                }
              />{" "}
              I have also informed the reporting person
            </label>
            <button className="ia-primary" disabled={busy}>
              {busy ? "Saving…" : "Save result"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "stage" && (
        <Modal title={editId ? "Edit stage" : "Add a stage"} close={close}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveStage();
            }}
          >
            <label>
              Stage name
              <input
                required
                maxLength={150}
                value={stageForm.title}
                onChange={(e) =>
                  setStageForm({ ...stageForm, title: e.target.value })
                }
              />
            </label>
            <label>
              How to do this stage
              <textarea
                required
                maxLength={6000}
                placeholder="What to do, where to look, what to record and who to update"
                value={stageForm.instructions}
                onChange={(e) =>
                  setStageForm({ ...stageForm, instructions: e.target.value })
                }
              />
            </label>
            <label>
              Contact script (optional)
              <textarea
                maxLength={4000}
                value={stageForm.contact_script}
                onChange={(e) =>
                  setStageForm({ ...stageForm, contact_script: e.target.value })
                }
              />
            </label>
            <button className="ia-primary" disabled={busy}>
              {busy ? "Saving…" : "Save stage"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "complete" && selectedStage && (
        <Modal title="Record stage completion" close={close}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void completeStage();
            }}
          >
            <p className="ia-form-context">{selectedStage.title}</p>
            <label>
              Stage result / evidence
              <textarea
                required
                maxLength={4000}
                placeholder={
                  selectedStage.stage_key === "handover"
                    ? "Record the project owner’s final sign-off, handover date and evidence link."
                    : "What confirms this stage is complete? Include the result and any evidence links."
                }
                value={completion}
                onChange={(e) => setCompletion(e.target.value)}
              />
            </label>
            <p className="ia-muted">
              Open duties must be completed or reassigned first.
            </p>
            <button className="ia-primary" disabled={busy}>
              {busy ? "Saving…" : "Complete this stage"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "observation" && (
        <Modal title="Record readiness observation" close={close}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveObservation();
            }}
          >
            <p className="ia-form-context">
              {
                ACTIONABLES_REFERENCE.auditCriteria.find(
                  (c) => c.id === observation.criterion,
                )?.text
              }
            </p>
            <label>
              Observed result
              <select
                required
                value={observation.state}
                onChange={(e) =>
                  setObservation({ ...observation, state: e.target.value })
                }
              >
                <option value="">Choose after reviewing</option>
                <option value="ready">Meets the reviewed requirement</option>
                <option value="gap">Gap to resolve</option>
                <option value="not_applicable">
                  Not applicable (explain why)
                </option>
              </select>
            </label>
            <label>
              Observation / evidence
              <textarea
                required
                minLength={10}
                maxLength={4000}
                placeholder="What you reviewed, the requirement used, evidence and any next action"
                value={observation.evidence}
                onChange={(e) =>
                  setObservation({ ...observation, evidence: e.target.value })
                }
              />
            </label>
            <label>
              Source or evidence link (optional)
              <input
                type="url"
                maxLength={2000}
                value={observation.source}
                onChange={(e) =>
                  setObservation({ ...observation, source: e.target.value })
                }
              />
            </label>
            <p className="ia-muted">
              A new observation keeps earlier records and your name. It does not
              change provider approval.
            </p>
            <button className="ia-primary" disabled={busy}>
              {busy ? "Saving…" : "Record observation"}
            </button>
          </form>
        </Modal>
      )}
      {confirmation && (
        <Modal
          title={confirmation.title}
          close={() => {
            if (!busy) setConfirmation(null);
          }}
        >
          <p>{confirmation.text}</p>
          <div className="ia-confirm-actions">
            <button
              className="ia-secondary"
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button
              className="ia-primary ia-delete"
              disabled={busy}
              onClick={() => void mutate(confirmation.run, "Deleted")}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
