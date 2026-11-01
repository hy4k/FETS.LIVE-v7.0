import { useEffect, useState } from 'react';
import { CalendarDays, Home, Users, PanelsTopLeft, Grid2X2, WifiOff, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { usesAdminWorkspace, workspaceFor } from '../redesign/workspace-features';
import WorkspaceMenu from '../redesign/WorkspaceMenu';
import './mobile-workspace.css';

export const MOBILE_TABS = [
  { id: 'live', label: 'Home', icon: Home },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'roster', label: 'Roster', icon: Users },
  { id: 'desk', label: 'My Desk', icon: PanelsTopLeft },
];
export const mobileToApp = (id: string) => ({ live: 'command-center', calendar: 'fets-calendar', roster: 'fets-roster', desk: 'my-desk', case: 'incident-log' }[id] || id);
export const appToMobile = (id: string) => ({ 'command-center': 'live', 'fets-calendar': 'calendar', 'fets-roster': 'roster', 'my-desk': 'desk', 'incident-log': 'case' }[id] || id);

export function mobileMenuItems(admin: boolean, permissions?: Record<string, unknown> | null) {
  return [
    { id: 'actionables', label: 'Actionables', sub: 'Announcements and follow-through' },
    { id: 'handover', label: 'The Shift', sub: 'Duties, floor rota and handovers' },
    ...workspaceFor(admin, permissions),
    { id: 'fets-intelligence', label: 'FETS AI', sub: 'Your operations assistant' },
    { id: 'expansion', label: 'Mission 7', sub: 'Centre planning and expansion' },
    { id: 'profile', label: 'My profile', sub: 'Your details and account' },
    { id: 'logout', label: 'Log out', sub: 'End this session' },
  ];
}

export function MobileHeader({ branch, onBranchChange, navigate, title = 'Your working day' }: {
  branch: string; onBranchChange: (branch: string) => void; navigate: (id: string) => void; title?: string;
}) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return <>
    <header className="mobile-workspace-header">
      <button className="mobile-brand" aria-label="FETS LIVE home" onClick={() => navigate('live')}>
        <img src="/brand/app-icon.png" alt="" /><span>fets<span className="mobile-brand-dot">.</span>live<small>{title}</small></span>
      </button>
      <label className="mobile-centre"><span className="sr-only">Active centre</span>
        <select aria-label="Active centre" value={branch} onChange={event => onBranchChange(event.target.value)}>
          <option value="calicut">Calicut</option><option value="cochin">Cochin</option><option value="global">All centres</option>
        </select><ChevronDown size={14} aria-hidden="true" />
      </label>
    </header>
    {!online && <div className="mobile-offline" role="status"><WifiOff size={15} /> You're offline. Reconnect before saving changes.</div>}
  </>;
}

export function MobileNavigation({ active, navigate, pending = 0, onLogout }: { active: string; navigate: (id: string) => void; pending?: number; onLogout?: () => void }) {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const items = mobileMenuItems(usesAdminWorkspace(profile?.role === 'super_admin', profile?.email), profile?.permissions);
  return <>
    <nav className="mobile-workspace-nav" aria-label="Mobile workspace">
      {MOBILE_TABS.map(({ id, label, icon: Icon }) => <button key={id} aria-current={active === id ? 'page' : undefined} onClick={() => navigate(id)}>
        <span className="mobile-tab-icon"><Icon size={21} strokeWidth={active === id ? 2.3 : 1.7} />{id === 'desk' && pending > 0 && <span className="mobile-tab-badge" aria-label={`${pending} pending handovers`}>{pending > 9 ? '9+' : pending}</span>}</span><span>{label}</span>
      </button>)}
      <button aria-label="More workspace tools" aria-expanded={open} aria-current={!MOBILE_TABS.some(tab => tab.id === active) ? 'page' : undefined} onClick={() => setOpen(true)}><span className="mobile-tab-icon"><Grid2X2 size={21} /></span><span>More</span></button>
    </nav>
    <WorkspaceMenu open={open} onClose={() => setOpen(false)} onPick={item => item.id === 'logout' ? (onLogout ? onLogout() : signOut()) : navigate(item.id)} items={items} />
  </>;
}
