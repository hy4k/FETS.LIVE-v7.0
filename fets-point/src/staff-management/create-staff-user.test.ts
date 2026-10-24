import { describe, it, expect, vi } from "vitest";
import {
  createStaffHandler,
  staffPayload,
} from "../../../supabase/functions/create-staff-user/handler";
const body = () => ({
  full_name: " Sample Staff ",
  email: "SAMPLE@EXAMPLE.TEST",
  password: "sample-only-123",
  branch_assigned: "calicut",
  joining_date: "2026-10-24",
  contact_number: "1234567890",
  department: "Operations",
  position: "Invigilator",
  permissions: { employee_id: "FETS90", designation: "Administrator" },
  certificates: [{ title: "Training certificate" }],
  trainings_attended: [{ title: "Exam-day orientation" }],
  future_trainings: [{ title: "First aid" }],
  remarks: "Fictional fixture",
});
function setup(opts: any = {}) {
  const profile = { role: "super_admin", is_active: true, ...opts.profile };
  const actor = {
    id: "author",
    email: "mithun@fets.in",
    email_confirmed_at: "2026-01-01",
    app_metadata: {},
    ...opts.actor,
  };
  const createUser = vi
    .fn()
    .mockResolvedValue(
      opts.createError
        ? { error: { message: "Email already registered" } }
        : { data: { user: { id: "new-user" } } },
    );
  const deleteUser = vi
    .fn()
    .mockResolvedValue({ error: opts.cleanupError ? {} : null });
  const insert = vi.fn((row: any) => ({
    select: () => ({
      single: async () => ({ data: row, error: opts.insertError ? {} : null }),
    }),
  }));
  const admin = {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue(
          opts.authError ? { error: {} } : { data: { user: actor } },
        ),
      admin: { createUser, deleteUser },
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: (column: string) =>
          column === "email"
            ? {
                limit: async () => ({
                  data: opts.duplicate ? [{ id: "existing" }] : [],
                }),
              }
            : { single: async () => ({ data: profile }) },
        ilike: () => ({
          limit: async () => ({
            data: opts.duplicate ? [{ id: "existing" }] : [],
          }),
        }),
      }),
      insert,
    })),
  };
  const run = (data: any = body(), token = "verified-token") =>
    createStaffHandler(admin)(
      new Request("https://example.test/create-staff-user", {
        method: "POST",
        headers: token ? { Authorization: "Bearer " + token } : {},
        body: JSON.stringify(data),
      }),
    );
  return { admin, run, insert, createUser, deleteUser };
}
describe("staff account creation", () => {
  it("requires authentication before creating anything", async () => {
    const t = setup();
    expect((await t.run(body(), "")).status).toBe(401);
    expect(t.admin.from).not.toHaveBeenCalled();
  });
  it("rejects expired sessions", async () => {
    const t = setup({ authError: true });
    expect((await t.run()).status).toBe(401);
    expect(t.createUser).not.toHaveBeenCalled();
  });
  it("does not trust a forged profile/user_metadata super-admin role", async () => {
    const t = setup({
      actor: {
        email: "staff@example.test",
        user_metadata: { role: "super_admin" },
      },
    });
    expect((await t.run()).status).toBe(403);
    expect(t.createUser).not.toHaveBeenCalled();
  });
  it("permits existing Niyas super-admin identity and server-owned future admin roles", async () => {
    for (const actor of [
      { email: "niyas@fets.in" },
      { email: "future@example.test", app_metadata: { role: "super_admin" } },
    ])
      expect((await setup({ actor }).run()).status).toBe(200);
  });
  it("rejects inactive and downgraded administrators", async () => {
    for (const profile of [{ is_active: false }, { role: "staff" }])
      expect((await setup({ profile }).run()).status).toBe(403);
  });
  it("saves every staff field without obsolete columns or credentials in the profile", async () => {
    const t = setup();
    expect(
      (
        await t.run({
          ...body(),
          id: "injected",
          user_id: "injected",
          branch_location: "cochin",
        })
      ).status,
    ).toBe(200);
    const p = t.insert.mock.calls[0][0];
    expect(p).toMatchObject({
      id: "new-user",
      user_id: "new-user",
      email: "sample@example.test",
      full_name: "Sample Staff",
      joining_date: "2026-10-24",
      hire_date: "2026-10-24",
      base_centre: "calicut",
      contact_number: "1234567890",
      permissions: { employee_id: "FETS90", designation: "Administrator" },
      certificates: [{ title: "Training certificate" }],
      trainings_attended: [{ title: "Exam-day orientation" }],
      future_trainings: [{ title: "First aid" }],
      remarks: "Fictional fixture",
    });
    expect(p).not.toHaveProperty("password");
    expect(p).not.toHaveProperty("branch_location");
    expect(t.createUser.mock.calls[0][0].user_metadata).toEqual({
      full_name: "Sample Staff",
    });
  });
  it("maps global and Kannur without violating the base-centre constraint", () => {
    for (const branch_assigned of ["global", "kannur"])
      expect(
        staffPayload({ ...body(), branch_assigned }).profile.base_centre,
      ).toBeNull();
  });
  it("validates email, password, dates and role before account creation", async () => {
    for (const bad of [
      { email: "invalid" },
      { password: "123" },
      { joining_date: "2026-02-30" },
      { role: "owner" },
      { branch_assigned: "wrong" },
    ]) {
      const t = setup();
      expect((await t.run({ ...body(), ...bad })).status).toBe(400);
      expect(t.createUser).not.toHaveBeenCalled();
    }
  });
  it("rejects duplicate profile email without changing the existing account", async () => {
    const t = setup({ duplicate: true });
    expect((await t.run()).status).toBe(409);
    expect(t.createUser).not.toHaveBeenCalled();
    expect(t.deleteUser).not.toHaveBeenCalled();
  });
  it("does not delete an existing auth user on duplicate login", async () => {
    const t = setup({ createError: true });
    expect((await t.run()).status).toBe(400);
    expect(t.deleteUser).not.toHaveBeenCalled();
  });
  it("rolls back only the new login if profile insertion fails", async () => {
    const t = setup({ insertError: true });
    expect((await t.run()).status).toBe(500);
    expect(t.deleteUser).toHaveBeenCalledWith("new-user");
  });
  it("reports partial failure truthfully if rollback fails", async () => {
    const t = setup({ insertError: true, cleanupError: true });
    expect((await (await t.run()).json()).error).toContain(
      "Contact support before retrying",
    );
  });
});
