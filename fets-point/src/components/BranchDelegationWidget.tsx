import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as DB from '../redesign/write-data';
import {
  Shield, Plus, Trash2, Calendar, User, Clock,
  ArrowRight, Search, Info, AlertCircle, RefreshCw
} from 'lucide-react';

interface DelegationRecord {
  id: string;
  profile_id: string;
  allowed_branch: string;
  start_date: string;
  end_date: string;
  created_at: string;
  staff_profiles?: {
    full_name: string;
    email: string;
  };
}

export function BranchDelegationWidget() {
  const { profile } = useAuth();
  const [delegations, setDelegations] = useState<DelegationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [allowedBranch, setAllowedBranch] = useState('both');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    // format to YYYY-MM-DDTHH:MM
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    // default to tomorrow
    const tomorrow = new Date(now.setDate(now.getDate() + 1));
    return new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [searchQuery, setSearchQuery] = useState('');

  const fets = (window as any).FETS;
  const staffList = Object.entries(fets?._staffIdByName || {}).map(([name, id]) => ({
    name,
    id: id as string,
    email: fets?._staffRatesByName?.[name]?.email || ''
  })).sort((a, b) => a.name.localeCompare(b.name));

  const fetchDelegations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('staff_branch_delegations')
        .select(`
          id,
          profile_id,
          allowed_branch,
          start_date,
          end_date,
          created_at,
          staff_profiles (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setDelegations(data || []);
      if (fets) {
        fets._branchDelegations = data || [];
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDelegations();
  }, [fetchDelegations]);

  const handleAddDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileId) {
      alert('Please select a staff member');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      alert('End date must be after start date');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        profile_id: selectedProfileId,
        allowed_branch: allowedBranch,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString()
      };

      const result = await DB.dbAddBranchDelegation(payload);
      if (result) {
        // Reset form
        setSelectedProfileId('');
        // Refresh list
        await fetchDelegations();
      }
    } catch (e: any) {
      alert(e.message || 'Failed to save delegation');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDelegation = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this delegation?')) return;
    try {
      await DB.dbDeleteBranchDelegation(id);
      await fetchDelegations();
    } catch (e: any) {
      alert(e.message || 'Failed to revoke delegation');
    }
  };

  const getStatus = (start: string, end: string) => {
    const now = new Date();
    const startTime = new Date(start);
    const endTime = new Date(end);

    if (now < startTime) {
      return { label: 'Scheduled', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    } else if (now > endTime) {
      return { label: 'Expired', color: 'text-white/20 bg-white/5 border-white/5' };
    } else {
      return { label: 'Active', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
    }
  };

  const filteredDelegations = delegations.filter(d => {
    const name = d.staff_profiles?.full_name?.toLowerCase() || '';
    const email = d.staff_profiles?.email?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-full bg-[#080f10] overflow-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-25 bg-[#FACC15]/20" />
          <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full blur-[100px] opacity-10 bg-teal-500/30" />
        </div>

        <div className="relative max-w-4xl mx-auto px-5 pt-8 pb-6 md:pt-12 md:pb-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center border bg-[#FACC15]/10 border-[#FACC15]/20">
                <Shield className="w-6 h-6 md:w-7 md:h-7 text-[#FACC15]" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Branch Access Delegation</h1>
                <p className="text-[11px] text-white/40 uppercase tracking-[0.2em] mt-1">
                  Grant Temporary Cross-Center Permissions
                </p>
              </div>
            </div>
            <button
              onClick={fetchDelegations}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 text-white/60 text-xs font-bold rounded-xl hover:bg-white/10 disabled:opacity-40 transition-all uppercase tracking-wider"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-5" />

      {/* Main Content Grid */}
      <div className="max-w-4xl mx-auto px-5 py-6 md:py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Form Card */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#FACC15]/50 to-transparent" />
            <h3 className="text-base font-black text-white tracking-tight mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#FACC15]" /> New Access Window
            </h3>

            <form onSubmit={handleAddDelegation} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Staff Profile</label>
                <select
                  value={selectedProfileId}
                  onChange={e => setSelectedProfileId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FACC15]/50"
                  required
                >
                  <option value="" className="bg-[#080f10]">Select User</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#080f10]">
                      {s.name} ({s.email ? s.email.split('@')[0] : 'No Email'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Allow Center Access</label>
                <select
                  value={allowedBranch}
                  onChange={e => setAllowedBranch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FACC15]/50"
                >
                  <option value="both" className="bg-[#080f10]">Both Cochin & Calicut</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Start Date & Time</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FACC15]/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">End Date & Time</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FACC15]/50"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#FACC15] text-[#080f10] text-xs font-black rounded-xl hover:bg-[#FACC15]/90 disabled:opacity-40 transition-all uppercase tracking-wider shadow-lg shadow-[#FACC15]/10"
              >
                {saving ? 'Creating Access…' : 'Delegate Access'}
              </button>
            </form>
          </div>

          <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex items-start gap-3">
            <Info className="w-4 h-4 text-[#FACC15]/60 flex-shrink-0 mt-0.5" />
            <p className="text-[10.5px] text-white/30 leading-normal">
              When a user has an active delegation, they will see the Cochin / Calicut selector unlocked in the Lost & Found form, allowing them to log items at both branches.
            </p>
          </div>
        </div>

        {/* Right Columns: Delegations List */}
        <div className="md:col-span-2 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-white/20 absolute left-4.5 top-3.5" />
            <input
              type="text"
              placeholder="Search delegations by staff name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/8 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FACC15]/40 transition-all"
            />
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-300 text-sm">Error Loading Delegations</p>
                <p className="text-xs text-red-400/70 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#FACC15]/20 border-t-[#FACC15] animate-spin" />
              <p className="text-xs text-white/30 uppercase tracking-widest">Loading records…</p>
            </div>
          )}

          {/* List Cards */}
          {!loading && !error && (
            <div className="space-y-3">
              {filteredDelegations.length === 0 ? (
                <div className="text-center py-16 bg-white/[0.01] border border-white/5 border-dashed rounded-3xl">
                  <User className="w-8 h-8 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/30 font-bold">No access delegations found</p>
                  <p className="text-xs text-white/20 mt-1">Create a delegation to grant temporary access.</p>
                </div>
              ) : (
                filteredDelegations.map(d => {
                  const status = getStatus(d.start_date, d.end_date);
                  return (
                    <div
                      key={d.id}
                      className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex items-center justify-between hover:border-white/15 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                          <User className="w-5 h-5 text-white/40" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white tracking-tight">
                              {d.staff_profiles?.full_name || 'Unknown User'}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-full border text-[8px] font-black tracking-widest uppercase ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-white/20 mt-0.5">
                            {d.staff_profiles?.email || 'No email registered'}
                          </p>
                          
                          {/* Duration display */}
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-white/40 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#FACC15]/60" />
                              {formatDate(d.start_date)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-white/20" />
                            <span className="flex items-center gap-1 font-semibold text-white/60">
                              <Clock className="w-3 h-3 text-[#FACC15]/60" />
                              {formatDate(d.end_date)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteDelegation(d.id)}
                        className="p-2.5 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all ml-4"
                        title="Revoke access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default BranchDelegationWidget;
