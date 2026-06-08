
import React, { useEffect, useState, ReactNode, useCallback } from 'react';

import { useAuth } from '../hooks/useAuth';

import { supabase } from '../lib/supabase';

import { BranchContext, BranchType, ViewMode } from './BranchContextValue';


// Re-export types for convenience
export type { BranchType, ViewMode };



interface BranchProviderProps {

  children: ReactNode;

}



const VALID_BRANCHES: BranchType[] = ['calicut', 'cochin', 'kannur', 'global'];

function branchStorageKey(authUserId: string) {
  return `fets_active_branch__${authUserId}`;
}

export function BranchProvider({ children }: BranchProviderProps) {

  const { profile, user } = useAuth();

  // Fixed: canAccessBranch initialization order

  const [activeBranch, setActiveBranchState] = useState<BranchType>(() => {
    // Try to get from local storage or default to calicut
    const saved = localStorage.getItem('fets_active_branch');
    return (saved as BranchType) || 'calicut';
  });

  const [viewMode, setViewMode] = useState<ViewMode>('single');

  const [branchStatus, setBranchStatus] = useState<{ [key: string]: any }>({});

  const [loading, setLoading] = useState(true);

  const [isSwitching, setIsSwitching] = useState(false);



  // User permissions from profile

  const userBranchAccess = profile?.branch_assigned || 'calicut';

  const userAccessLevel = profile?.role || 'staff';



  const canAccessBranch = useCallback((branch: BranchType): boolean => {
    if (!profile) return false;
    // Allow all users to access all branches
    return true;
  }, [profile]);



  const loadBranchStatus = useCallback(async () => {

    try {

      const { data, error } = await supabase

        .from('branch_status')

        .select('*')

        .order('branch_name');



      if (error) {

        console.error('❌ Error loading branch status:', error.message);

        return;

      }



      if (data) {

        const statusMap = data.reduce((acc, status) => {

          acc[status.branch_name] = status;

          return acc;

        }, {} as { [key: string]: any });



        setBranchStatus(statusMap);

      }

    } catch (error: any) {

      console.error('❌ Exception loading branch status:', error.message);

    } finally {

      setLoading(false);

    }

  }, []);



  const setActiveBranch = useCallback(async (branch: BranchType) => {

    if (!canAccessBranch(branch) || branch === activeBranch) return;
    if (!user?.id) return;


    // Add switching animation class
    document.body.classList.add('branch-switching');

    setIsSwitching(true);



    try {
      // Update state and persistence (per auth user + legacy mirror for pre-auth reads)
      setActiveBranchState(branch);
      localStorage.setItem(branchStorageKey(user.id), branch);
      localStorage.setItem('fets_active_branch', branch);
    } finally {

      setTimeout(() => {
        setIsSwitching(false);
        document.body.classList.remove('branch-switching');
      }, 600);

    }

  }, [canAccessBranch, activeBranch, user?.id]);



  // When the signed-in user changes: default active branch strictly to their profile's assigned branch
  // to avoid cross-center mistakes on shared center machines.
  useEffect(() => {
    if (!user?.id || !profile) return;

    const key = branchStorageKey(user.id);
    const profileBranch = profile.branch_assigned || 'calicut';
    
    let defaultBranch: BranchType = 'calicut';
    if (profileBranch === 'cochin') defaultBranch = 'cochin';
    else if (profileBranch === 'calicut') defaultBranch = 'calicut';
    else if (profileBranch === 'kannur') defaultBranch = 'kannur';
    else if (profileBranch === 'global') defaultBranch = 'global';
    else if (profileBranch === 'both') defaultBranch = 'calicut';

    setActiveBranchState(defaultBranch);
    localStorage.setItem(key, defaultBranch);
    localStorage.setItem('fets_active_branch', defaultBranch);
  }, [user?.id, profile?.user_id]);



  // Load branch status data

  useEffect(() => {

    loadBranchStatus();

  }, [loadBranchStatus]);



  // Set up real-time subscriptions for branch status

  useEffect(() => {

    const subscription = supabase

      .channel('branch-status-changes')

      .on('postgres_changes',

        { event: '*', schema: 'public', table: 'branch_status' },

        () => {

          console.log('🔄 Branch status updated, reloading...');

          loadBranchStatus();

        }

      )

      .subscribe();



    return () => {

      subscription.unsubscribe();

    };

  }, [loadBranchStatus]);



  const canUseDualMode = (): boolean => {

    return userAccessLevel === 'super_admin' || userAccessLevel === 'admin';

  };



  const getBranchTheme = (branch: BranchType): string => {

    switch (branch) {

      case 'calicut':

        return 'branch-calicut';

      case 'cochin':

        return 'branch-cochin';

      case 'kannur':

        return 'branch-kannur';

      case 'global':

        return 'branch-global';

      default:

        return 'branch-calicut';

    }

  };



  const value = {

    activeBranch,

    setActiveBranch,

    viewMode,

    setViewMode,

    userBranchAccess,

    userAccessLevel,

    branchStatus,

    loading,

    isSwitching,

    canAccessBranch,

    canUseDualMode,

    getBranchTheme

  };



  return (

    <BranchContext.Provider value={value}>

      {children}

    </BranchContext.Provider>

  );

}



