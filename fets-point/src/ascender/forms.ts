export type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: [string, string][];
  min?: number;
  max?: number;
  hint?: string;
};
const people = (staff: any[]): [string, string][] =>
  staff.filter((s) => s.is_active !== false).map((s) => [s.id, s.full_name]);
export function fields(
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
    default:
      return [];
  }
}
export const defaults: Record<string, any> = {
  ascender_rooms: { total_seats: 0, unavailable_seats: 0 },
  ascender_programmes: { approval: "not_checked" },
  compliance_items: {
    category: "other",
    frequency: "once",
    lead_days: 30,
    active: true,
  },
  ascender_deployments: { status: "planned", readiness: "not_checked" },
};
export function payload(fields: Field[], value: any) {
  return Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.type === "number"
        ? value[f.key] === "" || value[f.key] == null
          ? null
          : Number(value[f.key])
        : f.type === "date" || f.key.endsWith("_id")
          ? value[f.key] || null
          : String(value[f.key] ?? "").trim(),
    ]),
  );
}
