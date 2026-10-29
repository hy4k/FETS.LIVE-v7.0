import { describe, it, expect } from "vitest";
import { tenure, indiaDay } from "./model";
import {
  mergeVault,
  safeLink,
  customFields,
  type VaultItem,
} from "../vault-workspace/model";
import { clientSupport } from "./HelpDesk";
describe("personal workspace data", () => {
  it("counts inclusive calendar days in India rather than elapsed hours", () => {
    const now = new Date("2026-10-28T20:00:00Z");
    expect(indiaDay(now)).toBe("2026-10-29");
    expect(tenure("2026-10-28", now)).toBe(2);
    expect(tenure("2026-10-29", now)).toBe(1);
    for (const input of [undefined, "2026-02-30", "2026-10-30", "n/a"])
      expect(tenure(input, now)).toBeNull();
  });
  it("keeps newest Quick Access values and merges additional data without deleting records", () => {
    const base: VaultItem = {
      id: "old",
      user_id: "owner",
      title: "Portal",
      url: "https://example.test",
      username: "staff",
      password: "older",
      notes: "Old note",
      created_at: "2026-01-01",
      custom_fields: [{ key: "Centre", value: "One" }],
    };
    const newer = {
      ...base,
      id: "new",
      created_at: "2026-10-01",
      password: "quick",
      notes: "Quick note",
      custom_fields: [{ key: "Other", value: "Two" }],
    };
    const result = mergeVault([base, newer]);
    expect(result).toHaveLength(1);
    expect(result[0].password).toBe("quick");
    expect(result[0].notes).toBe("Quick note\nOld note");
    expect(result[0].custom_fields).toHaveLength(2);
    expect(base.password).toBe("older");
    expect(mergeVault([result[0], base])[0].notes).toBe("Quick note\nOld note");
  });
  it("never merges different owners, accounts or sites, and excludes soft-deleted entries", () => {
    const base: VaultItem = {
      id: "a",
      user_id: "u",
      title: "Portal",
      username: "one",
    };
    expect(
      mergeVault([
        base,
        { ...base, id: "b", user_id: "v" },
        { ...base, id: "c", username: "two" },
        { ...base, id: "d", site_id: "other" },
        { ...base, id: "e", is_deleted: true },
      ]),
    ).toHaveLength(4);
  });
  it("keeps case-sensitive accounts and portal paths distinct", () => {
    const base: VaultItem = {
      id: "a",
      user_id: "u",
      title: "Portal",
      username: "Staff",
      url: "https://example.test/One",
    };
    expect(
      mergeVault([
        base,
        { ...base, id: "b", username: "staff" },
        { ...base, id: "c", url: "https://example.test/one" },
      ]),
    ).toHaveLength(3);
  });
  it("supports legacy JSON custom fields and rejects executable links", () => {
    expect(customFields({ Site: 123, Secret: "value" })).toEqual([
      { key: "Site", value: "123" },
      { key: "Secret", value: "value" },
    ]);
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("https://example.test")).toBe("https://example.test/");
  });
  it("uses official support channels and labels unverified contacts honestly", () => {
    expect(clientSupport("PROMETRIC").links[0].url).toBe(
      "https://ehelp.prometric.com/",
    );
    expect(clientSupport("PSI").links[0].url).toContain(
      "helpdesk.psionline.com",
    );
    expect(clientSupport("PARAGON").note).toContain("Public CELPIP");
    expect(clientSupport("ITTS").links).toHaveLength(0);
  });
});
