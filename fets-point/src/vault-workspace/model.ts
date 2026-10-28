export type VaultItem = {
  id: string;
  user_id: string;
  title: string;
  category?: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  site_id?: string;
  prof_email?: string;
  prof_email_password?: string;
  other_urls?: string;
  contact_numbers?: string;
  custom_fields?: { key: string; value: string }[];
  tags?: string[];
  created_at?: string;
  description?: string;
  content?: string;
  file_url?: string;
  is_deleted?: boolean;
  mergedIds?: string[];
};
const norm = (v?: string) =>
  String(v || "")
    .trim()
    .toLowerCase();
export const safeLink = (value?: string) => {
  try {
    const url = new URL(value || "");
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};
export function customFields(value: unknown): { key: string; value: string }[] {
  if (Array.isArray(value))
    return value
      .filter((v) => v && typeof v.key === "string" && v.value != null)
      .map((v) => ({ key: v.key, value: String(v.value) }));
  if (value && typeof value === "object")
    return Object.entries(value)
      .filter(([, v]) => typeof v === "string" || typeof v === "number")
      .map(([key, value]) => ({ key, value: String(value) }));
  return [];
}
export function mergeVault(items: VaultItem[]) {
  const groups = new Map<string, VaultItem>();
  for (const row of [...items]
    .filter((x) => !x.is_deleted)
    .sort(
      (a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "") ||
        a.id.localeCompare(b.id),
    )) {
    const url = safeLink(row.url);
    const identity = [
      row.user_id,
      norm(row.title),
      (url || String(row.url || "").trim()).replace(/\/$/, ""),
      String(row.username || "").trim(),
      String(row.site_id || "").trim(),
    ].join("\u001f");
    const existing = groups.get(identity);
    if (!existing) {
      groups.set(identity, {
        ...row,
        custom_fields: customFields(row.custom_fields),
        mergedIds: [row.id],
      });
      continue;
    }
    // Quick Access reads newest first from this same table. Its values win;
    // fill missing fields and preserve distinct notes/additional fields.
    const merged = {
      ...row,
      ...existing,
      mergedIds: [...existing.mergedIds!, row.id],
    };
    for (const key of [
      "password",
      "prof_email",
      "prof_email_password",
      "description",
      "content",
      "file_url",
    ] as const)
      if (!existing[key]) merged[key] = row[key];
    for (const key of ["notes", "other_urls", "contact_numbers"] as const)
      merged[key] = [
        ...new Set(
          [existing[key], row[key]]
            .filter(Boolean)
            .flatMap((value) => value!.split("\n")),
        ),
      ].join("\n");
    merged.tags = [...new Set([...(existing.tags || []), ...(row.tags || [])])];
    const fields = new Map<string, { key: string; value: string }>();
    for (const field of [
      ...customFields(existing.custom_fields),
      ...customFields(row.custom_fields),
    ])
      if (!fields.has(norm(field.key) + "\u001f" + field.value))
        fields.set(norm(field.key) + "\u001f" + field.value, field);
    merged.custom_fields = [...fields.values()];
    groups.set(identity, merged);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
}
