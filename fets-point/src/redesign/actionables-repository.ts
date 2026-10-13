import { supabase } from "../lib/supabase";
import type { ActionablesData, Criterion } from "./actionables-model";
export type EditableTable =
  | "expansion_institutions"
  | "mission_work_items"
  | "mission_task_updates"
  | "mission_institution_stages";
export interface ActionablesRepository {
  load: () => Promise<ActionablesData>;
  watch: (refresh: () => void) => () => void;
  save: (
    table: EditableTable,
    values: Record<string, unknown>,
    id?: string | null,
  ) => Promise<any>;
  remove: (table: EditableTable, id: string) => Promise<void>;
  selectTarget: (
    institutionId: string,
    selected: boolean,
    previousId?: string,
  ) => Promise<void>;
  observe: (
    institutionId: string,
    criterion: Criterion,
    state: string,
    evidence: string,
    source: string,
    previousId?: string,
  ) => Promise<void>;
}
async function read(table: string, projection = "*", sort = "id") {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(projection)
      .order(sort)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
export const actionablesRepository: ActionablesRepository = {
  async load() {
    const [institutions, stages, tasks, updates, caps] = await Promise.all([
      read("expansion_institutions", "*", "name"),
      read("mission_institution_stages", "*", "position"),
      read(
        "mission_work_items",
        "*,owner:staff_profiles!mission_work_items_owner_id_fkey(full_name)",
      ),
      read(
        "mission_task_updates",
        "*,author:staff_profiles!mission_task_updates_author_id_fkey(full_name),editor:staff_profiles!mission_task_updates_edited_by_fkey(full_name)",
        "created_at",
      ),
      supabase.rpc("fets_actionables_capabilities"),
    ]);
    if (caps.error && !["PGRST202", "42883"].includes(caps.error.code))
      throw caps.error;
    const extensionsReady =
      !caps.error && caps.data?.version >= 2 && caps.data?.rollout === true;
    if (!caps.error && caps.data?.version >= 2 && !extensionsReady)
      throw new Error(
        "Project access has not been assigned to this account. Ask management to enable your access.",
      );
    const directory = extensionsReady
      ? await supabase.rpc("fets_actionables_directory")
      : null;
    if (directory?.error) throw directory.error;
    const staff =
      directory?.data ||
      (await read(
        "staff_profiles",
        "id,user_id,full_name,role,is_active",
        "full_name",
      ));
    for (const task of tasks)
      task.owner = staff.find((p: any) => p.id === task.owner_id)
        ? {
            full_name: staff.find((p: any) => p.id === task.owner_id).full_name,
          }
        : task.owner;
    const [selections, observations, brief] = extensionsReady
      ? await Promise.all([
          read("mission_rollout_selections", "*", "created_at"),
          read("mission_readiness_observations", "*", "created_at"),
          read("mission_project_brief"),
        ])
      : [[], [], []];
    return {
      institutions,
      stages,
      tasks,
      updates,
      staff,
      selections,
      observations,
      extensionsReady,
      referenceTasks: brief[0]?.tasks || [],
      canManage: extensionsReady && caps.data?.manage === true,
      actor: extensionsReady
        ? {
            id: caps.data.profileId,
            user_id: caps.data.userId,
            full_name: caps.data.name,
          }
        : undefined,
    };
  },
  watch(refresh) {
    const ch = supabase.channel("actionables-clear-work");
    for (const table of [
      "expansion_institutions",
      "mission_institution_stages",
      "mission_work_items",
      "mission_task_updates",
      "mission_rollout_selections",
      "mission_readiness_observations",
    ])
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        refresh,
      );
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  },
  async save(table, values, id) {
    const q = id
      ? supabase.from(table).update(values).eq("id", id)
      : supabase.from(table).insert(values);
    const { data, error } = await q.select("*").single();
    if (error) throw error;
    return data;
  },
  async remove(table, id) {
    if (table === "expansion_institutions") {
      const { error } = await supabase.rpc("mission_delete_institution", {
        p_institution_id: id,
      });
      if (error) throw error;
      return;
    }
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw error;
    if (!data?.length)
      throw new Error(
        "This record changed or is no longer available. Refresh and try again.",
      );
  },
  async selectTarget(institutionId, selected, previousId) {
    const { error } = await supabase.from("mission_rollout_selections").insert({
      institution_id: institutionId,
      selected,
      previous_id: previousId || null,
    });
    if (error) throw error;
  },
  async observe(institutionId, criterion, state, evidence, source, previousId) {
    const { error } = await supabase
      .from("mission_readiness_observations")
      .insert({
        institution_id: institutionId,
        criterion,
        state,
        evidence,
        source_url: source,
        previous_id: previousId || null,
      });
    if (error) throw error;
  },
};
