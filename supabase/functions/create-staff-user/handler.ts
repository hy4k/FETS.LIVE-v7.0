export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-application",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, value: unknown) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
// Verified existing super-admin accounts predate app_metadata roles. Newly
// provisioned super admins receive server-owned app_metadata instead.
const legacyAdmins = new Set([
  "mithun@fets.in",
  "mithun@fets.live",
  "niyas@fets.in",
]);
function clean(value: unknown, label: string, max = 250, required = false) {
  if (value !== undefined && value !== null && typeof value !== "string")
    throw Error(`${label} must be text.`);
  const text = String(value ?? "").trim();
  if ((required && !text) || text.length > max)
    throw Error(
      `Enter a valid ${label.toLowerCase()} (maximum ${max} characters).`,
    );
  return text;
}
export function staffPayload(body: any) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw Error("Enter staff details.");
  const email = clean(body.email, "Email", 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Error("Enter a valid email.");
  const password = body.password;
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    throw Error("Use an initial password with 8–128 characters.");
  const role = body.role || "fetsian";
  if (!["staff", "fetsian", "admin", "super_admin"].includes(role))
    throw Error("Choose a valid role.");
  const branch =
    body.branch_assigned ||
    body.base_centre ||
    body.branch_location ||
    "global";
  if (!["calicut", "cochin", "global"].includes(branch))
    throw Error("Choose a valid branch.");
  const joining = clean(body.joining_date, "Joining date", 10);
  if (
    joining &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(joining) ||
      !Number.isFinite(Date.parse(joining + "T12:00:00Z")) ||
      new Date(joining + "T12:00:00Z").toISOString().slice(0, 10) !== joining)
  )
    throw Error("Choose a valid joining date.");
  const growth = (key: string) => {
    const rows = body[key] ?? [];
    if (!Array.isArray(rows) || rows.length > 50)
      throw Error(
        "Use at most 50 entries in each training or certificate section.",
      );
    return rows
      .map((x: any) => ({ title: clean(x?.title, key, 500) }))
      .filter((x) => x.title)
      .map((x) => ({ id: crypto.randomUUID(), title: x.title }));
  };
  const contact = clean(
    body.contact_number ?? body.phone,
    "Contact number",
    60,
  );
  return {
    password,
    profile: {
      email,
      full_name: clean(body.full_name, "Full name", 200, true),
      role,
      department: clean(
        body.department ?? "Operations",
        "Department",
        150,
        true,
      ),
      branch_assigned: branch,
      base_centre: ["calicut", "cochin"].includes(branch) ? branch : null,
      contact_number: contact,
      phone: contact,
      joining_date: joining || null,
      hire_date: joining || null,
      position: clean(body.position, "Position"),
      permissions: {
        employee_id: clean(body.permissions?.employee_id, "Employee ID", 80),
        designation: clean(body.permissions?.designation, "Designation"),
        is_roster_active: true,
      },
      certificates: growth("certificates"),
      trainings_attended: growth("trainings_attended"),
      future_trainings: growth("future_trainings"),
      remarks: clean(body.remarks, "Remarks", 10000),
      is_active: true,
      status: "active",
    },
  };
}
export function createStaffHandler(admin: any) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS")
      return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST")
      return reply(405, { success: false, error: "Use POST." });
    let createdId: string | null = null;
    try {
      const token = req.headers
        .get("Authorization")
        ?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token)
        return reply(401, {
          success: false,
          error: "Sign in before adding a user.",
        });
      const { data: identity, error: authError } =
        await admin.auth.getUser(token);
      const actor = identity?.user;
      if (authError || !actor)
        return reply(401, {
          success: false,
          error: "Your session expired. Sign in again.",
        });
      const trusted =
        !!actor.email_confirmed_at &&
        (legacyAdmins.has(String(actor.email).toLowerCase()) ||
          actor.app_metadata?.role === "super_admin");
      if (!trusted)
        return reply(403, {
          success: false,
          error: "Only a super admin can add users.",
        });
      const { data: profile, error: profileError } = await admin
        .from("staff_profiles")
        .select("role,is_active")
        .eq("user_id", actor.id)
        .single();
      if (
        profileError ||
        profile?.role !== "super_admin" ||
        profile?.is_active === false
      )
        return reply(403, {
          success: false,
          error: "Only an active super admin can add users.",
        });
      let value;
      try {
        value = staffPayload(await req.json());
      } catch (e) {
        return reply(400, {
          success: false,
          error: e instanceof Error ? e.message : "Invalid staff details.",
        });
      }
      const existing = await admin
        .from("staff_profiles")
        .select("id")
        .eq("email", value.profile.email)
        .limit(1);
      if (existing.error)
        return reply(500, {
          success: false,
          error: "Could not check existing staff. Try again.",
        });
      if (existing.data?.length)
        return reply(409, {
          success: false,
          error:
            "A staff profile already uses this email. Open that profile instead.",
        });
      const { data, error } = await admin.auth.admin.createUser({
        email: value.profile.email,
        password: value.password,
        email_confirm: true,
        user_metadata: { full_name: value.profile.full_name },
        app_metadata: { role: value.profile.role },
      });
      if (error || !data?.user)
        return reply(400, {
          success: false,
          error: error?.message || "Could not create the login.",
        });
      createdId = data.user.id;
      const result = await admin
        .from("staff_profiles")
        .insert({ ...value.profile, id: createdId, user_id: createdId })
        .select()
        .single();
      if (result.error) throw Error("Profile creation failed");
      createdId = null;
      return reply(200, { success: true, data: { profile: result.data } });
    } catch {
      if (createdId) {
        try {
          const rollback = await admin.auth.admin.deleteUser(createdId);
          if (rollback.error) throw Error("cleanup failed");
        } catch {
          return reply(500, {
            success: false,
            error:
              "The login was created but its profile could not be saved. Contact support before retrying this email.",
          });
        }
      }
      return reply(500, {
        success: false,
        error:
          "Could not create the staff profile. No completed staff account was added; please try again.",
      });
    }
  };
}
