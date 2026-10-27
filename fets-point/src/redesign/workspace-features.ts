/**
 * What each person sees in the Workspace menu (the four-square icon, top
 * right). Home, Calendar, Roster, My Desk and Actionables are available as home cards,
 * so they are never repeated here.
 *
 * Each feature has a default by role. The super admin can switch any feature
 * on or off for any person in User Management; that choice is kept in the
 * person's staff_profiles.permissions as `ws_<feature id>` and wins over the
 * default.
 */
export type WorkspaceFeature = { id: string; label: string; sub: string; staff: boolean; admin: boolean; placement?: 'home' | 'desk' };

export const WORKSPACE_FEATURES: WorkspaceFeature[] = [
  { placement:'home', id:'fets-space', label:'FETS Space', sub:'Workspace setup to follow', staff:false, admin:true },
  { placement: 'home', id: 'fets-chat', label: 'Team Space', sub: 'Conversations, decisions and follow-through', staff: true, admin: true },
  { id: 'client-directory', label: 'Clients & programmes', sub: 'Shared provider and exam catalogue', staff: false, admin: true },
  { id: 'candidate-tracker', label: 'Candidate Tracker', sub: 'Registrations & sessions', staff: true, admin: true },
  { placement: 'desk', id: 'case', label: 'Raise a case', sub: 'Record an incident or ask for support', staff: false, admin: false },
  { id: 'attn-admin', label: 'Daily Attendance', sub: 'All staff check-in / out', staff: false, admin: true },
  { id: 'business', label: 'Google Business', sub: 'Reviews, ratings & reach', staff: false, admin: true },
  { placement: 'desk', id: 'access-hub', label: 'F-Vault / Access Hub', sub: 'Credentials & access', staff: false, admin: true },
  { id: 'staff-ot', label: 'OT & TOIL Manager', sub: 'Overtime logging & TOIL cash payouts', staff: false, admin: true },
  { id: 'dashboard', label: 'Dashboard', sub: 'iCloud overview', staff: false, admin: false },
  { placement: 'home', id: 'news-manager', label: 'FETS News', sub: 'Client updates and industry news', staff: true, admin: true },
  { placement: 'home', id: 'system-manager', label: 'FETS Sites', sub: 'Test centre administration', staff: false, admin: true },
  { id: 'user-management', label: 'User Management', sub: 'Roles & permissions', staff: false, admin: true },
  { id: 'branch-delegation', label: 'Branch Access Delegation', sub: 'Temporary access override', staff: false, admin: true },
];

/** People who get the super admin's workspace by default, besides super admins. */
export const ADMIN_WORKSPACE_EMAILS = ['niyas@fets.in'];

export const featureKey = (id: string) => `ws_${id}`;

export function usesAdminWorkspace(isAdmin: boolean, email?: string | null) {
  return isAdmin || ADMIN_WORKSPACE_EMAILS.includes(String(email || '').trim().toLowerCase());
}

/** The default for a person, before any choice in User Management. */
export function featureDefault(f: WorkspaceFeature, adminWorkspace: boolean) {
  return adminWorkspace ? f.admin : f.staff;
}

/** Is this feature in this person's Workspace menu? */
export function hasFeature(f: WorkspaceFeature, adminWorkspace: boolean, permissions?: Record<string, unknown> | null) {
  const chosen = permissions?.[featureKey(f.id)];
  return typeof chosen === 'boolean' ? chosen : featureDefault(f, adminWorkspace);
}

export function workspaceFor(adminWorkspace: boolean, permissions?: Record<string, unknown> | null) {
  return WORKSPACE_FEATURES.filter(f => !f.placement && hasFeature(f, adminWorkspace, permissions));
}
