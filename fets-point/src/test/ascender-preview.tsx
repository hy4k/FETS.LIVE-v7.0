import React from "react";
import { createRoot } from "react-dom/client";
import AscenderManager from "../ascender/AscenderManager";
import type { CentreData, Repository } from "../ascender/repository";
import { validateRecord } from "../ascender/model";
const w = window as any;
const stamp = "2026-10-25T06:00:00Z";
const data: CentreData = {
  centres: ["calicut", "cochin", "mobile"].map((code, i) => ({
    id: "centre-" + i,
    code,
    updated_at: stamp,
    version: 1,
  })),
  rooms: [],
  fields: [],
  inventory: [],
  programmes: [],
  documents: [],
  renewals: [],
  deployments: [],
  history: [],
  staff: [
    {
      id: "person",
      user_id: "user",
      full_name: "Example Manager",
      branch_assigned: "calicut",
      is_active: true,
    },
  ],
  clients: [{ id: "client", name: "Example partner" }],
  sessions: [],
  leads: [],
};
const keys: Record<string, keyof CentreData> = {
  ascender_centres: "centres",
  ascender_rooms: "rooms",
  ascender_programmes: "programmes",
  ascender_documents: "documents",
  compliance_items: "renewals",
  ascender_deployments: "deployments",
  ascender_fields: "fields",
  ascender_inventory: "inventory",
};
const repository: Repository = {
  async load() {
    if (new URLSearchParams(location.search).has("denied"))
      throw Error(
        "Ascender Manager is available to authorised administrators only.",
      );
    if (w.failLoad) throw Error("Connection unavailable. Retry.");
    return structuredClone(data);
  },
  async save(table, value, previous) {
    validateRecord(table, value);
    if (w.failSave)
      throw Error("Connection unavailable. Your changes are not saved.");
    const key = keys[table],
      record = {
        ...previous,
        ...value,
        id: previous?.id || crypto.randomUUID(),
        version: (previous?.version || 0) + 1,
        updated_at: stamp,
        active: value.active ?? previous?.active ?? true,
      };
    w.lastSaved = { table, value };
    if (previous)
      data[key] = data[key].map((r) => (r.id === previous.id ? record : r));
    else data[key].push(record);
    data.history.unshift({
      id: crypto.randomUUID(),
      centre_id: table === "ascender_centres" ? record.id : record.centre_id,
      table_name: table,
      record_id: record.id,
      actor_id: "user",
      changed_at: stamp,
      before_data: previous || null,
      after_data: record,
    });
  },
};
createRoot(document.getElementById("root")!).render(
  <>
    <div style={{ padding: 10, background: "#fff0cd", font: "12px system-ui" }}>
      Design preview · fictional centre records · no live changes
    </div>
    <AscenderManager
      repository={repository}
      onNavigate={(page, branch) => {
        w.lastNavigation = { page, branch };
      }}
    />
  </>,
);
