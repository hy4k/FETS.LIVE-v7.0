import { safeLink } from "./model";
export type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: [string, string][];
  min?: number;
  max?: number;
  hint?: string;
  custom?: boolean;
  removed?: boolean;
  setting?: any;
};
const people = (staff: any[]): [string, string][] =>
  staff.filter((s) => s.is_active !== false).map((s) => [s.id, s.full_name]);
function baseFields(
  table: string,
  staff: any[],
  clients: any[],
  renewals: any[],
): Field[] {
  const person = (key: string, label: string): Field => ({
    key,
    label,
    type: "select",
    options: people(staff),
  });
  const text = (key: string, label: string, required = false): Field => ({
    key,
    label,
    required,
  });
  const notes = (key = "notes", label = "Notes"): Field => ({
    key,
    label,
    type: "textarea",
  });
  const seats = (key: string, label: string, required = false): Field => ({
    key,
    label,
    type: "number",
    min: 0,
    max: 10000,
    required,
  });
  const client: Field = {
    key: "client_id",
    label: "Exam partner",
    type: "select",
    options: clients.map((c) => [c.id, c.name]),
  };
  const date = (key: string, label: string, required = false): Field => ({
    key,
    label,
    type: "date",
    required,
  });
  const select = (
    key: string,
    label: string,
    options: [string, string][],
  ): Field => ({ key, label, type: "select", options, required: true });
  switch (table) {
    case "ascender_centres":
      return [
        text("address", "Address"),
        { key: "map_url", label: "Location link", type: "url" },
        text("contact_phone", "Centre phone"),
        { key: "contact_email", label: "Centre email", type: "email" },
        person("manager_id", "Responsible manager"),
        person("backup_id", "Backup contact"),
        text("operating_hours", "Centre opening hours"),
        date("hours_effective_from", "Hours effective from"),
        {
          ...notes(),
          hint: "Centre opening hours do not change staff shifts. Set staff timings in Roster.",
        },
      ];
    case "ascender_rooms":
      return [
        text("name", "Room / lab name", true),
        seats("total_seats", "Total seats", true),
        seats("unavailable_seats", "Unavailable seats", true),
        text("accessibility", "Accessibility facilities"),
        notes(),
      ];
    case "ascender_programmes":
      return [
        { ...client, required: true },
        text("programme", "Programme", true),
        text("site_code", "Partner centre code"),
        seats("approved_capacity", "Approved seats"),
        select("approval", "Approval", [
          ["not_checked", "Not checked"],
          ["approved", "Approved"],
          ["suspended", "Suspended"],
        ]),
        {
          key: "evidence_url",
          label: "Approval document link",
          type: "url",
          hint: "Link the existing document. Approval is specific to this programme and centre.",
        },
        notes(),
      ];
    case "ascender_documents":
      return [
        text("title", "Document name", true),
        {
          key: "url",
          label: "Existing document link",
          type: "url",
          required: true,
          hint: "Use its existing secure location. This page does not copy files or store passwords.",
        },
        person("owner_id", "Responsible person"),
        {
          key: "compliance_id",
          label: "Related renewal",
          type: "select",
          options: renewals.map((r) => [r.id, r.title]),
        },
        notes(),
      ];
    case "compliance_items":
      return [
        text("title", "Renewal / deadline", true),
        select("category", "Category", [
          ["certification", "Certification"],
          ["audit", "Inspection / audit"],
          ["insurance", "Insurance"],
          ["contract", "Contract"],
          ["bill", "Bill"],
          ["other", "Other"],
        ]),
        person("owner_profile_id", "Responsible person"),
        date("next_due", "Next due date", true),
        {
          key: "lead_days",
          label: "Show reminder this many days before",
          type: "number",
          min: 0,
          max: 365,
          required: true,
        },
        select("frequency", "Frequency", [
          ["once", "One-time"],
          ["monthly", "Monthly"],
          ["quarterly", "Quarterly"],
          ["half_yearly", "Half-yearly"],
          ["yearly", "Yearly"],
        ]),
        {
          ...notes(),
          hint: "Reminders appear here. Update the next due date when renewed; this does not send messages or automatically mark work complete.",
        },
      ];
    case "ascender_deployments":
      return [
        text("venue", "Host institution / venue", true),
        text("address", "Venue address"),
        text("contact", "Local contact"),
        client,
        text("programme", "Programme"),
        date("start_date", "First exam date", true),
        date("end_date", "Last exam date", true),
        date("setup_due", "Setup due", true),
        seats("required_seats", "Required seats"),
        person("lead_id", "Deployment lead"),
        notes("transport_notes", "Transport / setup arrangements"),
        select("status", "Deployment status", [
          ["planned", "Planned"],
          ["setup", "Setting up"],
          ["active", "Active"],
          ["closed", "Closed"],
          ["cancelled", "Cancelled"],
        ]),
        select("readiness", "Readiness", [
          ["not_checked", "Not checked"],
          ["needs_attention", "Needs attention"],
          ["confirmed", "Confirmed by me"],
        ]),
        {
          ...notes("readiness_note", "Readiness evidence / outstanding issue"),
          hint: "Confirmation records your identity and time. Existing exam checks remain in The Shift and FETS Online.",
        },
        notes("closeout_notes", "Return / handover notes"),
      ];
    case "ascender_inventory":
      return [
        text("name", "Item name"),
        text("category", "Category"),
        {
          key: "quantity",
          label: "Quantity",
          type: "number",
          min: 0,
          max: 1000000,
        },
        text("unit", "Unit"),
        text("location", "Location / room"),
        notes(),
      ];
    default:
      return [];
  }
}
export function fields(
  table: string,
  staff: any[],
  clients: any[],
  renewals: any[],
): Field[] {
  return baseFields(table, staff, clients, renewals).map((f) => ({
    ...f,
    required: false,
  }));
}
export const defaults: Record<string, any> = {};
export function configuredFields(
  table: string,
  data: any,
  centreId: string,
  includeRemoved = false,
): Field[] {
  const settings = (data.fields || []).filter(
    (f: any) => f.centre_id === centreId && f.section === table,
  );
  const builtins = fields(
    table,
    data.staff || [],
    data.clients || [],
    (data.renewals || []).filter(
      (r: any) => r.centre_id === centreId && r.active,
    ),
  );
  return [
    ...builtins.map((f) => {
      const saved = settings.find((s: any) => s.field_key === f.key);
      return {
        ...f,
        label: saved?.label || f.label,
        removed: saved?.removed || false,
        setting: saved,
      };
    }),
    ...settings
      .filter((s: any) => s.kind !== "builtin")
      .map((s: any) => ({
        key: s.field_key,
        label: s.label,
        type: s.kind === "choice" ? "select" : s.kind,
        options:
          s.kind === "checkbox"
            ? [
                ["true", "Yes"],
                ["false", "No"],
              ]
            : s.options.map((o: string) => [o, o]),
        custom: true,
        removed: s.removed,
        setting: s,
      })),
  ].filter((f) => includeRemoved || !f.removed);
}
export function answerValue(row: any, f: Field) {
  return (f as any).custom ? row.custom_answers?.[f.key] : row[f.key];
}
export function payload(defs: Field[], value: any) {
  const result: any = {},
    custom = { ...(value.custom_answers || {}) };
  for (const field of defs) {
    const f = field as any;
    const v = value[f.key];
    let answer: any =
      v === "" || v == null
        ? null
        : f.type === "number"
          ? Number(v)
          : f.type === "checkbox"
            ? v === true || v === "true"
            : String(v).trim() || null;
    if (f.type === "url" && answer !== null) {
      const link = safeLink(String(answer));
      if (!link)
        throw Error(
          "Use a complete HTTPS link without embedded login details.",
        );
      answer = link;
    }
    if (f.type === "number" && answer !== null && !Number.isFinite(answer))
      throw Error("Enter a valid number for " + f.label + ".");
    if (f.custom) {
      if (answer == null) delete custom[f.key];
      else custom[f.key] = answer;
    } else result[f.key] = answer;
  }
  result.custom_answers = custom;
  return result;
}
