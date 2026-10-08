import { supabase } from "../lib/supabase";
import { blueprintRepository } from "./shift-blueprint-repository";
import type { DayTask, ListItem } from "./shift-blueprint";
import type { DevelopmentNote, WorkAction } from "./shift-work";
const db = supabase as any;
const checked = (r: any) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
export const workRepository = {
  async activity(taskId: string): Promise<
    {
      id: string;
      kind: string;
      actor_id: string;
      created_at: string;
      before_state: DayTask | null;
      after_state: DayTask | null;
    }[]
  > {
    return (
      checked(
        await db
          .from("centre_task_activity")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: false })
          .limit(100),
      ) || []
    );
  },
  async access(
    branch: string,
    day: string,
  ): Promise<{ lead: boolean; manager: boolean }> {
    return checked(
      await db.rpc("fets_shift_access", { centre: branch, work_day: day }),
    );
  },
  async ensure(item: ListItem, branch: string, day: string): Promise<DayTask> {
    if (item.task) return item.task;
    return blueprintRepository.setTask({
      task: null,
      branch,
      day,
      responsibility_id: item.responsibility?.id ?? null,
      title: item.title,
      assigned_to: item.assignee,
      status: "open",
      note: "",
    });
  },
  async action(
    task: DayTask,
    action: WorkAction,
    note = "",
    category = "",
  ): Promise<DayTask> {
    return checked(
      await db.rpc("fets_shift_task_action", {
        task_id: task.id,
        expected_version: task.version,
        operation: action,
        explanation: note,
        support_kind: category,
      }),
    );
  },
  async assign(
    task: DayTask,
    assigned_to: string | null,
    due_minute: number | null,
    priority: "normal" | "important",
    expected_result: string,
    instructions: string,
  ): Promise<DayTask> {
    const rows = checked(
      await db
        .from("centre_day_tasks")
        .update({
          assigned_to,
          due_minute,
          priority,
          expected_result,
          instructions,
        })
        .eq("id", task.id)
        .eq("version", task.version)
        .select(),
    );
    if (!rows?.[0])
      throw new Error("This duty changed. Refresh before assigning it.");
    return rows[0];
  },
  async add(input: {
    branch: string;
    day: string;
    title: string;
    assigned_to: string;
    expected_result: string;
    instructions: string;
    due_minute: number | null;
    priority: string;
  }): Promise<DayTask> {
    return checked(
      await db
        .from("centre_day_tasks")
        .insert({ ...input, status: "open" })
        .select()
        .single(),
    );
  },
  async history(branch: string, from: string, to: string): Promise<DayTask[]> {
    // Paginate: a month's duties can exceed the API's default row limit.
    const all: DayTask[] = [];
    for (let offset = 0; ; offset += 500) {
      const rows =
        checked(
          await db
            .from("centre_day_tasks")
            .select("*")
            .eq("branch", branch)
            .gte("day", from)
            .lte("day", to)
            .order("day")
            .order("id")
            .range(offset, offset + 499),
        ) || [];
      all.push(...rows);
      if (rows.length < 500) return all;
    }
  },
  async notes(branch: string): Promise<DevelopmentNote[]> {
    const all: DevelopmentNote[] = [];
    for (let offset = 0; ; offset += 500) {
      const rows =
        checked(
          await db
            .from("centre_staff_development")
            .select("*")
            .eq("branch", branch)
            .order("created_at", { ascending: false })
            .order("id")
            .range(offset, offset + 499),
        ) || [];
      all.push(...rows);
      if (rows.length < 500) return all;
    }
  },
  async saveNote(input: {
    branch: string;
    profile_id: string;
    kind: DevelopmentNote["kind"];
    evidence: string;
    context: string;
    action: string;
    review_on: string;
    task_ids: string[];
    context_reviewed: boolean;
  }): Promise<DevelopmentNote> {
    return checked(
      await db.from("centre_staff_development").insert(input).select().single(),
    );
  },
  async closeNote(id: string, followup_result: string) {
    return checked(
      await db
        .from("centre_staff_development")
        .update({ status: "closed", followup_result })
        .eq("id", id)
        .select()
        .single(),
    ) as DevelopmentNote;
  },
  async respond(id: string, staff_response: string) {
    return checked(
      await db
        .from("centre_staff_development")
        .update({ staff_response })
        .eq("id", id)
        .select()
        .single(),
    ) as DevelopmentNote;
  },
};
export type WorkRepository = typeof workRepository;
