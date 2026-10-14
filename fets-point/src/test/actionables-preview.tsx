// Local preview uses the exact user-confirmed source catalogue and team task records.
// Changes stay in memory; this entry is excluded from the production build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { ActionablesWorkspace } from "../redesign/MissionWorkspace";
import { DEFAULT_STAGES } from "../redesign/institution-workflow";
import type {
  ActionablesData,
  ActionablesIdentity,
} from "../redesign/actionables-model";
import type {
  ActionablesRepository,
  EditableTable,
} from "../redesign/actionables-repository";
import reference from "./actionables-reference.json";
const profile: ActionablesIdentity = {
  id: "preview-account",
  user_id: "preview-account",
  full_name: "Current staff account",
};
const district: Record<string, string> = {
  cochin: "Ernakulam",
  calicut: "Calicut",
  thrissur: "Thrissur",
  kannur: "Kannur",
  kottayam: "Kottayam",
};
const initial: ActionablesData = {
  institutions: reference.institutions.map((i) => ({
    id: i.id,
    name: i.name,
    district: district[i.district],
    address: `${i.address}, PIN ${i.pincode}`,
    primary_contact_name: i.nodal,
    primary_contact_phone: i.phone,
    lab_seat_capacity: parseInt(i.capacity, 10),
    actionables_reference: i,
  })),
  stages: reference.institutions.flatMap((i) =>
    DEFAULT_STAGES.map((s, n) => ({
      ...s,
      id: `${i.id}-${s.stage_key}`,
      institution_id: i.id,
      position: n + 1,
      completion_note: "",
      completed_at: null,
    })),
  ),
  tasks: [],
  updates: [],
  staff: [{ ...profile, is_active: true, role: "admin" }],
  selections: [],
  observations: [],
  extensionsReady: true,
  canManage: true,
  referenceTasks: reference.tasks,
};
let state = structuredClone(initial);
const tableKey: Record<
  EditableTable,
  "institutions" | "stages" | "tasks" | "updates"
> = {
  expansion_institutions: "institutions",
  mission_institution_stages: "stages",
  mission_work_items: "tasks",
  mission_task_updates: "updates",
};
function Preview() {
  const [role, setRole] = useState("manager");
  const repository: ActionablesRepository = {
    load: async () => ({
      ...structuredClone(state),
      canManage: role === "manager",
    }),
    watch: () => () => {},
    save: async (table, values, id) => {
      const key = tableKey[table],
        rows = state[key] as any[];
      const before = rows.find((r) => r.id === id);
      const saved = {
        ...before,
        ...values,
        id: id || `local-${table}-${rows.length}`,
        created_at: before?.created_at || new Date().toISOString(),
      };
      if (table === "mission_work_items") {
        saved.status = before?.status || values.status || "open";
        saved.owner = state.staff.find((p) => p.id === saved.owner_id)
          ? {
              full_name: state.staff.find((p) => p.id === saved.owner_id)!
                .full_name,
            }
          : null;
      }
      if (table === "mission_task_updates") {
        const task = state.tasks.find((t) => t.id === saved.work_item_id)!;
        saved.author = { full_name: profile.full_name };
        saved.author_id = profile.id;
        saved.edited_by = profile.id;
        saved.report_to_id = before?.report_to_id || task.report_to_id;
        saved.report_method = before?.report_method || task.report_instructions;
        task.status = saved.status;
      }
      if (id)
        rows.splice(
          rows.findIndex((r) => r.id === id),
          1,
          saved,
        );
      else rows.push(saved);
      return saved;
    },
    remove: async (table, id) => {
      const key = tableKey[table];
      (state[key] as any[]) = (state[key] as any[]).filter((r) => r.id !== id);
    },
    selectTarget: async (institutionId, selected, previousId) => {
      state.selections.push({
        id: `local-selection-${state.selections.length}`,
        institution_id: institutionId,
        selected,
        previous_id: previousId,
        selected_by: profile.id,
        created_at: new Date().toISOString(),
      });
    },
    observe: async (
      institutionId,
      criterion,
      value,
      evidence,
      source,
      previousId,
    ) => {
      state.observations.push({
        id: `local-observation-${state.observations.length}`,
        institution_id: institutionId,
        criterion,
        state: value as any,
        evidence,
        source_url: source,
        previous_id: previousId,
        observed_by: profile.id,
        created_at: new Date().toISOString(),
      });
    },
  };
  return (
    <QueryClientProvider client={client}>
      <div className="preview-banner">
        <span>
          LOCAL PREVIEW · Actual supplied catalogue · Changes stay in memory
        </span>
        <select
          aria-label="Preview access"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            void client.invalidateQueries({
              queryKey: ["institution-actionables"],
            });
          }}
        >
          <option value="manager">Management access</option>
          <option value="staff">Staff access</option>
        </select>
      </div>
      <nav className="preview-nav">
        <strong>fets.live</strong>
        <span>Calendar</span>
        <span>Roster</span>
        <span>My Desk</span>
        <span className="active">Actionables</span>
        <span>The Shift</span>
      </nav>
      <ActionablesWorkspace
        key={role}
        profile={profile}
        repository={repository}
      />
      <Toaster />
    </QueryClientProvider>
  );
}
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 0 } },
});
createRoot(document.getElementById("root")!).render(<Preview />);
