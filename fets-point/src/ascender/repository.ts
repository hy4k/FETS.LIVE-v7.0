import { supabase } from "../lib/supabase";
import { istDay, monday, validateRecord } from "./model";
export type Row = Record<string, any>;
export interface CentreData {
  centres: Row[];
  rooms: Row[];
  programmes: Row[];
  documents: Row[];
  renewals: Row[];
  deployments: Row[];
  history: Row[];
  staff: Row[];
  clients: Row[];
  sessions: Row[];
  leads: Row[];
}
export interface Repository {
  load(): Promise<CentreData>;
  save(table: string, value: Row, previous?: Row): Promise<void>;
}
const tables = [
  "ascender_centres",
  "ascender_rooms",
  "ascender_programmes",
  "ascender_documents",
  "compliance_items",
  "ascender_deployments",
  "ascender_history",
];
async function read(table: string, projection = "*") {
  const all: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(projection)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    all.push(...(data || []));
    if ((data || []).length < 1000) return all;
  }
}
export const repository: Repository = {
  async load() {
    const caps = await supabase.rpc("ascender_capabilities");
    if (caps.error) throw caps.error;
    if (!caps.data)
      throw Error(
        "FETS Sites is unavailable for this account. Ask management to check your active status and FETS Sites permission in User Management.",
      );
    const day = istDay(),
      time = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date());
    const [
      centres,
      rooms,
      programmes,
      documents,
      renewals,
      deployments,
      history,
      staff,
      clients,
      ...other
    ] = await Promise.all([
      ...tables.slice(0, 6).map((t) => read(t)),
      supabase
        .from("ascender_history")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(200)
        .then((r) => {
          if (r.error) throw r.error;
          return r.data || [];
        }),
      read("staff_profiles", "id,user_id,full_name,branch_assigned,is_active"),
      read("clients", "id,name"),
      ...["calicut", "cochin"].map((branch) =>
        supabase
          .from("calendar_sessions")
          .select("id,branch_location,date,start_time,exam_name,client_name")
          .eq("branch_location", branch)
          .or(`date.gt.${day},and(date.eq.${day},start_time.gte.${time})`)
          .or("status.is.null,status.neq.cancelled")
          .order("date")
          .order("start_time")
          .limit(1)
          .then((r) => {
            if (r.error) throw r.error;
            return r.data || [];
          }),
      ),
      supabase
        .from("centre_lead_weeks")
        .select("branch,lead_id,week_start")
        .eq("week_start", monday(day))
        .then((r) => {
          if (r.error) throw r.error;
          return r.data || [];
        }),
    ]);
    return {
      centres,
      rooms,
      programmes,
      documents,
      renewals,
      deployments,
      history,
      staff,
      clients,
      sessions: [...other[0], ...other[1]],
      leads: other[2],
    };
  },
  async save(table, value, previous) {
    if (!tables.slice(0, 6).includes(table)) throw Error("Unsupported record.");
    validateRecord(table, value);
    let q = previous
      ? supabase
          .from(table)
          .update(value)
          .eq("id", previous.id)
          .eq("version", previous.version)
      : supabase.from(table).insert(value);
    const { data, error } = await q.select("id").single();
    if (error?.code === "PGRST116")
      throw Error(
        "This record changed while you were editing. Close the form, refresh, and try again.",
      );
    if (error?.code === "23505") throw Error("A record with this name already exists in this centre.");
    if (error) throw error;
    if (!data) throw Error("The record was not saved.");
  },
};
