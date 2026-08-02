/**
 * Shared roster-visibility semantics for the Super Admin "Include in Roster" toggle.
 *
 * A staff member is hidden from roster views when `permissions.is_roster_active === false`.
 * New exclusions are stamped with `permissions.roster_excluded_month = "YYYY-MM"` and
 * automatically expire when the month rolls over (the staff member reappears next month
 * unless the Super Admin excludes them again). Legacy exclusions saved without a month
 * stamp stay hidden until manually re-enabled.
 */

export const currentRosterMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const isStaffRosterVisible = (
  profile: any,
  monthKey: string = currentRosterMonthKey()
): boolean => {
  if (!profile) return true;
  const perms = (profile.permissions as any) || {};
  const excluded = perms.is_roster_active === false || (profile as any).is_roster_active === false;
  if (!excluded) return true;
  const stamp = perms.roster_excluded_month;
  if (!stamp) return false;          // legacy exclusion — hidden until re-enabled
  return stamp !== monthKey;         // stamped exclusion — hidden for that month only
};
