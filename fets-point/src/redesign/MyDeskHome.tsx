import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  ArrowLeft, Award, Camera, Check, Clock3, Coffee, Edit3, Flame,
  Globe, Heart, ImagePlus, Leaf, MapPin, MessageCircle, Search,
  ShieldCheck, Sparkles, Star, Trash2, Upload, Users, Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './my-desk.css';
import type { DeskRepository } from './desk-data';
import { useDeskDocument } from './useDeskSync';

export type DeskPerson = {
  id: string;
  user_id?: string;
  full_name: string;
  email?: string;
  role?: string;
  department?: string;
  position?: string;
  branch_assigned?: string;
  avatar_url?: string;
  bio?: string;
  skills?: string[];
  certifications?: string[];
  joining_date?: string;
  hire_date?: string;
  is_online?: boolean;
};

export type DeskPanel = 'time' | 'handovers' | 'checklist' | 'growth' | 'requests';

type Props = {
  repository?: DeskRepository;
  user: {
    id: string;
    profileId?: string;
    name: string;
    role: string;
    branch: string;
    avatar?: string;
    bio?: string;
    position?: string;
    department?: string;
    joining_date?: string;
    skills?: string[];
    certifications?: string[];
  };
  people: DeskPerson[];
  pendingHandovers: number | null;
  navigate: (page: string) => void;
  openDrawer: (drawer: string) => void;
  openChat: (person: DeskPerson) => void;
  renderPanel: (panel: DeskPanel) => React.ReactNode;
};

type CoverAura = 'solar' | 'noir' | 'emerald' | 'velvet';
type ActiveTab = 'crew' | 'requests' | 'time' | 'growth';

const COVER_AURAS: { id: CoverAura; label: string }[] = [
  { id: 'solar', label: 'Solar Gold' },
  { id: 'noir', label: 'Obsidian Pulse' },
  { id: 'emerald', label: 'Cyber Mint' },
  { id: 'velvet', label: 'Electric Violet' },
];

const NAV_TABS: { id: ActiveTab; label: string; sub: string; icon: typeof Users }[] = [
  { id: 'crew', label: 'All Members', sub: 'FETS Collective', icon: Users },
  { id: 'requests', label: 'Leave Application', sub: 'Leave & Swaps', icon: Coffee },
  { id: 'time', label: 'My Time', sub: 'Hours & Logs', icon: Clock3 },
  { id: 'growth', label: 'My Growth', sub: 'Certs & Skills', icon: Leaf },
];

const DEFAULT_VIBES = [
  'Running smooth exam sessions & keeping candidate nerves at zero.',
  'Precision check-ins, calm test rooms, and high-voltage coffee.',
  'Holding down the centre fort — every seat ready, every system green.',
  'Making high-stakes testing feel effortless for every candidate.',
  'Calicut ↔ Cochin collective energy. Always on point.',
  'Zero downtime, 100% readiness, good vibes on the floor.',
];

const DEFAULT_BADGES = [
  ['Zero-Incident Ops', 'Proctor Elite', 'Fast Check-In'],
  ['Candidate Whisperer', 'Systems Ready', 'Vault Cleared'],
  ['Morning Opener', 'CCTV Vigilance', 'Roster Anchor'],
  ['Audit Ready', 'Calm Under Pressure', 'Team Catalyst'],
];

function useSavedString(key: string, fallback = '') {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, value); } catch { /* Ignore storage quota/privacy errors */ }
  }, [key, value]);
  return [value, setValue] as const;
}

function handleOf(name: string, branch?: string) {
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'member';
  const b = (branch || '').toLowerCase();
  if (b.includes('calicut')) return `@${clean}.clt`;
  if (b.includes('cochin')) return `@${clean}.cok`;
  return `@${clean}.fets`;
}

function formatCentreTag(branch?: string) {
  const raw = (branch || '').trim().toLowerCase();
  if (!raw || raw === 'global' || raw === 'all' || raw === 'all centres') return { code: 'HQ', label: 'All Centres', tone: 'global' as const };
  if (raw.includes('calicut')) return { code: 'CLT', label: 'Calicut Centre', tone: 'calicut' as const };
  if (raw.includes('cochin')) return { code: 'COK', label: 'Cochin Centre', tone: 'cochin' as const };
  return { code: raw.slice(0, 3).toUpperCase(), label: branch!.replace(/_/g, ' '), tone: 'global' as const };
}

function formatRoleBadge(role?: string, position?: string) {
  const pos = (position || '').trim();
  const cleanRole = (role || 'Staff Member').replace(/_/g, ' ').trim();
  if (pos && !cleanRole.toLowerCase().includes(pos.toLowerCase())) {
    return `${pos.toUpperCase()} · ${cleanRole}`;
  }
  return cleanRole;
}

function hashIndex(seed: string, mod: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % mod;
}

function Portrait({ name, src, className = '' }: { name: string; src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'FL';

  return (
    <span className={`md-portrait ${className}`}>
      {src && !failed ? (
        <img src={src} alt={name} onError={() => setFailed(true)} />
      ) : (
        <span className="md-portrait-initials">{initials}</span>
      )}
    </span>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

export default function MyDeskHome(props: Props) {
  return <SocialProfileDesk key={props.user.id} {...props} />;
}

function SocialProfileDesk({ user, people, openChat, renderPanel, repository }: Props) {
  const coverInputId = useId();
  const avatarInputId = useId();

  const [tab, setTab] = useState<ActiveTab>(() => {
    const w = window as any;
    const asked = w.FETS?._deskTab as string | undefined;
    if (w.FETS) w.FETS._deskTab = undefined;
    if (asked === 'requests' || asked === 'time' || asked === 'growth') return asked;
    return 'crew';
  });

  useEffect(() => {
    const open = (e: Event) => {
      const asked = (e as CustomEvent<string>).detail;
      if (asked === 'requests' || asked === 'time' || asked === 'growth') {
        setTab(asked);
      } else if (asked === 'crew') {
        setTab('crew');
      }
    };
    window.addEventListener('fets-desk-tab', open);
    return () => window.removeEventListener('fets-desk-tab', open);
  }, []);

  const storagePrefix = `fets-desk:${user.id}`;
  const [localAura, setLocalAura] = useSavedString(`${storagePrefix}:cover`, 'solar');
  const [coverPhoto, setCoverPhoto] = useSavedString(`${storagePrefix}:cover-photo`, '');
  const [customAvatar, setCustomAvatar] = useSavedString(`${storagePrefix}:avatar-photo`, user.avatar || '');
  const [customBio, setCustomBio] = useSavedString(
    `${storagePrefix}:bio`,
    user.bio || DEFAULT_VIBES[hashIndex(user.id || user.name, DEFAULT_VIBES.length)]
  );

  const preferences = useDeskDocument(
    `${storagePrefix}:preferences`,
    { cover: localAura },
    repository ? () => repository.loadPreferences(user.id) : undefined,
    repository ? (value, version) => repository.savePreferences(user.id, value, version) : undefined,
    localAura !== 'solar'
  );

  const rawAura = repository ? preferences.value.cover : localAura;
  const activeAura: CoverAura = (['solar', 'noir', 'emerald', 'velvet'] as const).includes(rawAura as CoverAura)
    ? (rawAura as CoverAura)
    : 'solar';

  const setAura = (next: CoverAura) => {
    if (repository) preferences.edit({ cover: next });
    else setLocalAura(next);
  };

  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(customBio);

  useEffect(() => {
    if (!customAvatar && user.avatar) setCustomAvatar(user.avatar);
  }, [user.avatar]);

  // Build unified social member list: signed-in user first, then all active FETS.Live members
  const allMembers = useMemo<(DeskPerson & { isSelf?: boolean })[]>(() => {
    const selfMember: DeskPerson & { isSelf: boolean } = {
      id: user.profileId || user.id,
      user_id: user.id,
      full_name: user.name,
      role: user.role,
      position: user.position,
      department: user.department || 'Operations',
      branch_assigned: user.branch,
      avatar_url: customAvatar || user.avatar,
      bio: customBio || user.bio,
      skills: user.skills,
      certifications: user.certifications,
      joining_date: user.joining_date,
      is_online: true,
      isSelf: true,
    };

    const seen = new Set<string>([
      (user.profileId || '').toLowerCase(),
      (user.id || '').toLowerCase(),
      user.name.trim().toLowerCase(),
    ]);

    const others: (DeskPerson & { isSelf?: boolean })[] = [];
    for (const p of people) {
      if (!p || !p.full_name) continue;
      const nameKey = p.full_name.trim().toLowerCase();
      const idKey = (p.id || '').toLowerCase();
      if (seen.has(nameKey) || (idKey && seen.has(idKey))) continue;
      seen.add(nameKey);
      if (idKey) seen.add(idKey);
      others.push(p);
    }

    return [selfMember, ...others];
  }, [user, people, customAvatar, customBio]);

  const [spotlightId, setSpotlightId] = useState<string>(user.profileId || user.id);
  useEffect(() => {
    if (!allMembers.some(m => m.id === spotlightId)) {
      setSpotlightId(allMembers[0]?.id || user.id);
    }
  }, [allMembers, spotlightId, user.id]);

  const spotlightMember = useMemo(
    () => allMembers.find(m => m.id === spotlightId) || allMembers[0],
    [allMembers, spotlightId]
  );

  const isViewingSelf = Boolean(spotlightMember?.isSelf);

  // Social props / kudos state per member
  const [kudosMap, setKudosMap] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`${storagePrefix}:kudos`) || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch { /* ignore */ }
    return {};
  });

  const getMemberKudos = (member: DeskPerson) => {
    const base = 12 + hashIndex(member.id || member.full_name, 29);
    return base + (kudosMap[member.id] || 0);
  };

  const giveKudos = (member: DeskPerson) => {
    setKudosMap(prev => {
      const next = { ...prev, [member.id]: (prev[member.id] || 0) + 1 };
      try { localStorage.setItem(`${storagePrefix}:kudos`, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Search & centre filter for the All Members social feed
  const [searchQuery, setSearchQuery] = useState('');
  const [centreFilter, setCentreFilter] = useState<'all' | 'calicut' | 'cochin' | 'global'>('all');

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allMembers.filter(m => {
      const tag = formatCentreTag(m.branch_assigned);
      if (centreFilter !== 'all' && tag.tone !== centreFilter) return false;
      if (!q) return true;
      const hay = `${m.full_name} ${m.role || ''} ${m.position || ''} ${m.branch_assigned || ''} ${handleOf(m.full_name, m.branch_assigned)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allMembers, searchQuery, centreFilter]);

  // Handle top cover image upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus('Uploading cover artwork…');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCoverPhoto(dataUrl);
      setSpotlightId(user.profileId || user.id);

      // Try uploading to Supabase storage in background if signed in
      const ownerId = user.profileId || user.id;
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `covers/${ownerId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('profile-pictures').upload(filePath, file, { upsert: true });
      if (!upErr) {
        const { data } = supabase.storage.from('profile-pictures').getPublicUrl(filePath);
        if (data?.publicUrl) setCoverPhoto(data.publicUrl);
      }
      setUploadStatus('Cover image updated!');
    } catch {
      setUploadStatus('Could not load cover image.');
    } finally {
      e.target.value = '';
      window.setTimeout(() => setUploadStatus(null), 3200);
    }
  };

  // Handle portrait / avatar image upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus('Updating profile portrait…');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCustomAvatar(dataUrl);

      const ownerId = user.profileId || user.id;
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `avatars/${ownerId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('profile-pictures').upload(filePath, file, { upsert: true });
      if (!upErr) {
        const { data } = supabase.storage.from('profile-pictures').getPublicUrl(filePath);
        if (data?.publicUrl) {
          setCustomAvatar(data.publicUrl);
          if (user.profileId) {
            await supabase.from('staff_profiles').update({ avatar_url: data.publicUrl }).eq('id', user.profileId);
          }
        }
      }
      setUploadStatus('Portrait updated!');
    } catch {
      setUploadStatus('Could not update portrait.');
    } finally {
      e.target.value = '';
      window.setTimeout(() => setUploadStatus(null), 3200);
    }
  };

  const handleSaveBio = async () => {
    const trimmed = bioDraft.trim() || DEFAULT_VIBES[0];
    setCustomBio(trimmed);
    setIsEditingBio(false);
    if (user.profileId) {
      try {
        await supabase.from('staff_profiles').update({ bio: trimmed }).eq('id', user.profileId);
      } catch { /* fallback to localStorage already saved */ }
    }
  };

  const spotlightTag = formatCentreTag(spotlightMember?.branch_assigned);
  const spotlightHandle = handleOf(spotlightMember?.full_name || user.name, spotlightMember?.branch_assigned);
  const spotlightBio = spotlightMember?.isSelf
    ? customBio
    : (spotlightMember?.bio || DEFAULT_VIBES[hashIndex(spotlightMember?.id || spotlightMember?.full_name || '', DEFAULT_VIBES.length)]);
  const spotlightBadges = (spotlightMember?.skills && spotlightMember.skills.length > 0)
    ? spotlightMember.skills.slice(0, 4)
    : DEFAULT_BADGES[hashIndex(spotlightMember?.id || spotlightMember?.full_name || '', DEFAULT_BADGES.length)];

  return (
    <div className="my-desk" data-aura={activeAura}>
      {/* =================================================================
          1. TOP SOCIAL HERO & IMAGE UPLOAD SHOWCASE
         ================================================================= */}
      <section className="md-social-stage" aria-label="FETS Social Collective Profile">
        <div
          className={`md-hero-canvas ${coverPhoto && isViewingSelf ? 'has-custom-photo' : ''}`}
          style={coverPhoto && isViewingSelf ? { backgroundImage: `url(${coverPhoto})` } : undefined}
        >
          <div className="md-hero-mesh" aria-hidden="true">
            <div className="md-orb md-orb-1" />
            <div className="md-orb md-orb-2" />
            <div className="md-grid-lines" />
          </div>

          {/* Top Bar inside Hero: Brand Stamp + Image Upload Controls */}
          <div className="md-hero-topbar">
            <div className="md-brand-pill">
              <Sparkles size={13} />
              <span>FETS.LIVE // SOCIAL COLLECTIVE</span>
              <span className="md-serial-chip">#{String(allMembers.findIndex(m => m.id === spotlightMember?.id) + 1).padStart(2, '0')}</span>
            </div>

            <div className="md-hero-upload-bar">
              <div className="md-aura-picker" role="group" aria-label="Banner vibe">
                {COVER_AURAS.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={`md-aura-dot md-aura-${a.id}`}
                    aria-label={a.label}
                    aria-pressed={activeAura === a.id}
                    onClick={() => setAura(a.id)}
                    title={a.label}
                  >
                    {activeAura === a.id && <Check size={10} />}
                  </button>
                ))}
              </div>

              <label htmlFor={coverInputId} className="md-upload-trigger">
                <ImagePlus size={15} />
                <span>{coverPhoto ? 'Change Banner Photo' : 'Upload Banner Photo'}</span>
                <input
                  id={coverInputId}
                  type="file"
                  accept="image/*"
                  className="md-sr-only"
                  onChange={handleCoverUpload}
                />
              </label>

              {coverPhoto && (
                <button
                  type="button"
                  className="md-upload-clear"
                  onClick={() => setCoverPhoto('')}
                  title="Remove custom banner photo"
                  aria-label="Remove custom banner photo"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Unconventional Kinetic Hero Headline */}
          <div className="md-hero-editorial">
            <span className="md-editorial-kicker">
              {isViewingSelf ? 'YOUR LIVING PASSPORT' : `SPOTLIGHTING // ${spotlightTag.label.toUpperCase()}`}
            </span>
            <h1 className="md-editorial-title">
              THE PEOPLE WHO MAKE <em>FETS</em> MOVE<span>.</span>
            </h1>
          </div>

          {uploadStatus && (
            <div className="md-upload-toast" role="status">
              <Sparkles size={13} /> {uploadStatus}
            </div>
          )}
        </div>

        {/* Overlapping Social Passport Strip */}
        <div className="md-passport-deck">
          {/* Tilted Collectible Portrait Card with Direct Avatar Upload */}
          <div className="md-polaroid-wrap">
            <div className="md-polaroid-frame">
              <Portrait
                name={spotlightMember?.full_name || user.name}
                src={spotlightMember?.avatar_url}
                className="md-polaroid-img"
              />
              <span
                className={`md-live-beacon ${spotlightMember?.is_online !== false ? 'is-online' : ''}`}
                title={spotlightMember?.is_online !== false ? 'Active on FETS.Live' : 'Away'}
              />
              {isViewingSelf && (
                <label htmlFor={avatarInputId} className="md-avatar-upload-btn" title="Upload profile portrait">
                  <Camera size={14} />
                  <span>Upload Photo</span>
                  <input
                    id={avatarInputId}
                    type="file"
                    accept="image/*"
                    className="md-sr-only"
                    onChange={handleAvatarUpload}
                  />
                </label>
              )}
            </div>
            <div className="md-polaroid-caption">
              <span>{spotlightTag.code} // VERIFIED CREW</span>
              <ShieldCheck size={13} />
            </div>
          </div>

          {/* Main Identity & Bio Column */}
          <div className="md-passport-identity">
            <div className="md-name-row">
              <h2>{spotlightMember?.full_name}</h2>
              <span className="md-verified-pill" title="Verified FETS.Live Member">
                <ShieldCheck size={13} /> Verified
              </span>
              <span className={`md-centre-badge is-${spotlightTag.tone}`}>
                <MapPin size={11} /> {spotlightTag.label}
              </span>
              {!isViewingSelf && (
                <button
                  type="button"
                  className="md-back-self-btn"
                  onClick={() => setSpotlightId(user.profileId || user.id)}
                >
                  <ArrowLeft size={12} /> Back to my card
                </button>
              )}
            </div>

            <div className="md-handle-row">
              <span className="md-handle">{spotlightHandle}</span>
              <span className="md-dot">·</span>
              <span className="md-role-pill">{formatRoleBadge(spotlightMember?.role, spotlightMember?.position)}</span>
            </div>

            {/* Bio / Vibe Box */}
            <div className="md-vibe-box">
              {isViewingSelf && isEditingBio ? (
                <div className="md-vibe-editor">
                  <label htmlFor="md-bio-input" className="md-sr-only">Your bio or current vibe</label>
                  <input
                    id="md-bio-input"
                    type="text"
                    value={bioDraft}
                    maxLength={180}
                    onChange={e => setBioDraft(e.target.value)}
                    placeholder="Share your bio, motto, or current shift vibe…"
                    autoFocus
                  />
                  <button type="button" className="md-vibe-save" onClick={() => void handleSaveBio()}>
                    <Check size={13} /> Save Vibe
                  </button>
                </div>
              ) : (
                <div className="md-vibe-display">
                  <p>“{spotlightBio}”</p>
                  {isViewingSelf && (
                    <button
                      type="button"
                      className="md-vibe-edit-btn"
                      onClick={() => { setBioDraft(customBio); setIsEditingBio(true); }}
                      aria-label="Edit bio"
                    >
                      <Edit3 size={12} /> Edit bio
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Signature Skill / Vibe Chips */}
            <div className="md-skill-chips">
              {spotlightBadges.map(badge => (
                <span key={badge} className="md-skill-chip">
                  <Zap size={11} /> {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Right Social Metrics & Action Deck */}
          <div className="md-social-stats">
            <div className="md-stat-counters">
              <div className="md-stat-cell">
                <strong>{allMembers.length}</strong>
                <span>FETS Crew</span>
              </div>
              <div className="md-stat-cell">
                <strong>{getMemberKudos(spotlightMember)}</strong>
                <span>Vibe Props</span>
              </div>
              <div className="md-stat-cell">
                <strong>{spotlightTag.code}</strong>
                <span>Base Hub</span>
              </div>
            </div>

            <div className="md-hero-actions">
              <button
                type="button"
                className="md-kudos-cta"
                onClick={() => giveKudos(spotlightMember)}
              >
                <Flame size={15} />
                <span>Send Props</span>
                <em>+{kudosMap[spotlightMember?.id] || 0}</em>
              </button>

              {!isViewingSelf ? (
                <button
                  type="button"
                  className="md-chat-cta"
                  onClick={() => openChat(spotlightMember)}
                  aria-label={`Chat with ${spotlightMember.full_name}`}
                >
                  <MessageCircle size={15} />
                  <span>Message</span>
                </button>
              ) : (
                <label htmlFor={coverInputId} className="md-chat-cta">
                  <Upload size={14} />
                  <span>Upload Image</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* =================================================================
            2. SOCIAL STORY ORBIT RAIL (ALL MEMBERS QUICK SWITCHER)
           ================================================================= */}
        <div className="md-story-rail" aria-label="FETS.Live Members Story Orbit">
          <div className="md-story-label">
            <Flame size={13} />
            <span>LIVE CREW ORBIT</span>
          </div>
          <div className="md-story-track">
            {allMembers.map(member => {
              const active = member.id === spotlightMember?.id;
              const tag = formatCentreTag(member.branch_assigned);
              return (
                <button
                  key={member.id}
                  type="button"
                  className={`md-story-bubble is-${tag.tone} ${active ? 'is-active' : ''}`}
                  onClick={() => {
                    setSpotlightId(member.id);
                    if (tab !== 'crew') setTab('crew');
                  }}
                  aria-pressed={active}
                >
                  <span className="md-story-ring">
                    <Portrait name={member.full_name} src={member.avatar_url} className="md-story-avatar" />
                    <span className="md-story-badge">{tag.code}</span>
                  </span>
                  <span className="md-story-name">
                    {member.isSelf ? `${member.full_name.split(/\s+/)[0]} (You)` : member.full_name.split(/\s+/)[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================================================================
          3. CLEAN NAVIGATION BAR (NO "MY PROFILE" LINK, ONLY 4 TABS)
         ================================================================= */}
      <nav className="md-social-nav" aria-label="My Desk sections">
        {NAV_TABS.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`md-nav-pill ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              <span className="md-nav-icon"><Icon size={17} /></span>
              <span className="md-nav-text">
                <strong>{item.label}</strong>
                <small>{item.sub}</small>
              </span>
              {item.id === 'crew' && <span className="md-nav-count">{allMembers.length}</span>}
            </button>
          );
        })}
      </nav>

      {/* =================================================================
          4. TAB CONTENT: ALL MEMBERS SOCIAL DIRECTORY OR KEPT MODULES
         ================================================================= */}
      {tab === 'crew' ? (
        <section className="md-crew-wall" aria-label="All FETS.Live Members">
          <header className="md-wall-toolbar">
            <div className="md-wall-heading">
              <span className="md-kicker"><Globe size={13} /> FETS.LIVE DIRECTORY // SOCIAL WALL</span>
              <h2>Meet the Collective<span>.</span></h2>
            </div>

            <div className="md-wall-controls">
              <div className="md-filter-pills" role="group" aria-label="Filter by centre">
                {([
                  { id: 'all', label: 'All Crew' },
                  { id: 'calicut', label: 'Calicut' },
                  { id: 'cochin', label: 'Cochin' },
                  { id: 'global', label: 'Global HQ' },
                ] as const).map(f => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={centreFilter === f.id}
                    onClick={() => setCentreFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="md-search-box">
                <Search size={14} />
                <label htmlFor="md-member-search" className="md-sr-only">Find a member</label>
                <input
                  id="md-member-search"
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search members, @handles, roles…"
                />
              </div>
            </div>
          </header>

          {people.length === 0 && (
            <div className="md-crew-notice">
              <Users size={18} />
              <span>Your team will appear here when staff details are available. Showing your live passport card below.</span>
            </div>
          )}

          <div className="md-social-grid">
            {filteredMembers.map((member, index) => {
              const tag = formatCentreTag(member.branch_assigned);
              const handle = handleOf(member.full_name, member.branch_assigned);
              const memberBio = member.isSelf
                ? customBio
                : (member.bio || DEFAULT_VIBES[hashIndex(member.id || member.full_name, DEFAULT_VIBES.length)]);
              const badges = (member.skills && member.skills.length > 0)
                ? member.skills.slice(0, 3)
                : DEFAULT_BADGES[hashIndex(member.id || member.full_name, DEFAULT_BADGES.length)];
              const isSpotlighted = member.id === spotlightMember?.id;

              return (
                <article
                  key={member.id}
                  className={`md-member-card is-${tag.tone} ${isSpotlighted ? 'is-spotlighted' : ''}`}
                >
                  <div className="md-card-banner">
                    <span className="md-card-serial">CREW #{String(index + 1).padStart(2, '0')}</span>
                    <span className={`md-card-centre is-${tag.tone}`}>
                      <MapPin size={10} /> {tag.code} · {tag.label}
                    </span>
                  </div>

                  <div className="md-card-body">
                    <div className="md-card-top">
                      <button
                        type="button"
                        className="md-card-avatar-btn"
                        onClick={() => setSpotlightId(member.id)}
                        title={`Spotlight ${member.full_name}`}
                      >
                        <Portrait name={member.full_name} src={member.avatar_url} className="md-card-avatar" />
                        <span className={`md-card-online ${member.is_online !== false ? 'is-online' : ''}`} />
                      </button>

                      <div className="md-card-title">
                        <div className="md-card-name-row">
                          <h3>{member.full_name}</h3>
                          {member.isSelf && <span className="md-you-tag">YOU</span>}
                        </div>
                        <span className="md-card-handle">{handle}</span>
                        <span className="md-card-role">{formatRoleBadge(member.role, member.position)}</span>
                      </div>
                    </div>

                    <p className="md-card-bio">“{memberBio}”</p>

                    <div className="md-card-tags">
                      {badges.map(b => (
                        <span key={b} className="md-card-tag">
                          <Star size={10} /> {b}
                        </span>
                      ))}
                    </div>
                  </div>

                  <footer className="md-card-footer">
                    <button
                      type="button"
                      className="md-card-prop-btn"
                      onClick={() => giveKudos(member)}
                      aria-label={`Give props to ${member.full_name}`}
                    >
                      <Heart size={13} />
                      <span>{getMemberKudos(member)} Props</span>
                    </button>

                    <button
                      type="button"
                      className="md-card-Action"
                      onClick={() => setSpotlightId(member.id)}
                    >
                      <Award size={13} />
                      <span>{isSpotlighted ? 'In Spotlight' : 'Spotlight'}</span>
                    </button>

                    {!member.isSelf ? (
                      <button
                        type="button"
                        className="md-card-dm-btn"
                        onClick={() => openChat(member)}
                        aria-label={`Chat with ${member.full_name}`}
                      >
                        <MessageCircle size={13} />
                        <span>Chat</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="md-card-dm-btn"
                        onClick={() => { setBioDraft(customBio); setIsEditingBio(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      >
                        <Edit3 size={13} />
                        <span>Edit Bio</span>
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>

          {filteredMembers.length === 0 && (
            <div className="md-empty-search">
              <p>No FETS.Live members match “{searchQuery}”.</p>
              <button type="button" onClick={() => { setSearchQuery(''); setCentreFilter('all'); }}>
                Reset filters
              </button>
            </div>
          )}
        </section>
      ) : (
        <section
          className="md-panel"
          aria-label={NAV_TABS.find(t => t.id === tab)?.label || 'Workspace section'}
        >
          <div className="md-panel-heading">
            <button type="button" className="md-back-btn" onClick={() => setTab('crew')}>
              <ArrowLeft size={14} /> Back to All Members
            </button>
            <span className="md-kicker">
              {tab === 'requests'
                ? 'LEAVE APPLICATION & SHIFT SWAPS'
                : tab === 'time'
                  ? 'MY TIME & ATTENDANCE LOG'
                  : 'MY GROWTH & CERTIFICATIONS'}
            </span>
          </div>
          {renderPanel(tab)}
        </section>
      )}
    </div>
  );
}
