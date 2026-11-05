import { supabase } from "../lib/supabase";
import type { TimeData } from "./time-model";
export interface TimeRepository {
  load(profileId: string, from: string, to: string): Promise<TimeData>;
}
export const timeRepository: TimeRepository = {
  async load(profileId, from, to) {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user)
      throw Error("Sign in again to load your time records.");
    const { data: profile, error: profileError } = await supabase
      .from("staff_profiles")
      .select("id")
      .eq("id", profileId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (profileError || !profile)
      throw Error("Your staff record could not be verified. Refresh My Desk.");
    const read = async (table: string, column: string, projection: string) => {
      const all: any[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .from(table)
          .select(projection)
          .eq(column, profile.id)
          .gte("date", from)
          .lte("date", to)
          .order("date")
          .order("id")
          .range(offset, offset + 499);
        if (error)
          throw Error(
            "Your roster or attendance could not be loaded. Please retry.",
          );
        all.push(...(data || []));
        if ((data || []).length < 500) return all;
      }
    };
    const [schedules, attendance] = await Promise.all([
      read(
        "roster_schedules",
        "profile_id",
        "id,profile_id,date,branch_location,shift_code,shift_label,shift_start,shift_end,grace_minutes,overtime_hours,version",
      ),
      read(
        "staff_attendance",
        "staff_id",
        "id,staff_id,date,check_in,check_out,status,notes,branch_location",
      ),
    ]);
    return { schedules, attendance };
  },
};
