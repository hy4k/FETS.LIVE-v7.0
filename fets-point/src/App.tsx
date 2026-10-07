import { useState, useEffect, Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster, toast } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';

import { ThemeProvider } from './contexts/ThemeContext';
import { BranchProvider } from './contexts/BranchContext';
import { useBranch } from './hooks/useBranch';
import { ChatProvider, useChat } from './contexts/ChatContext';
import { CallProvider } from './contexts/CallContext';

import { ErrorBoundary } from './components/ErrorBoundary';
import { LazyErrorBoundary } from './components/LazyErrorBoundary';

import { PageLoadingFallback } from './components/LoadingFallback';
import { Login } from './components/Login';
import { BrandLoader } from './redesign/BrandExperience';
import { FetsAIAgent } from './fets-ai/FetsAIAgent';
import WorkspaceNavigation from './redesign/WorkspaceNavigation';
import { MobileHeader, MobileNavigation, appToMobile, mobileToApp } from './mobile/MobileWorkspace';
import { useNativeNavigation } from './mobile/useNativeNavigation';
import { UpdatePassword } from './components/UpdatePassword';


import { BranchIndicator } from './components/BranchIndicator';


import { supabase } from './lib/supabase';
import { useIsMobile, useScreenSize } from './hooks/use-mobile';
import { isMithunEmail } from './utils/authUtils';

import { initializeNative } from './mobile/initializeNative';

// Lazy load Desktop components
const Dashboard = lazy(() => import('./components/iCloud/iCloudDashboard').then(module => ({ default: module.ICloudDashboard })))
const AccessHubPage = lazy(() => import('./components/AccessHub').then(module => ({ default: module.AccessHub })))
const CommandCentre = lazy(() => import('./components/CommandCentreFinal'))
const RedesignShell = lazy(() => import('./redesign/RedesignShell'))
const CandidateTracker = lazy(() => import('./components/CandidateTrackerPremium').then(module => ({ default: module.CandidateTrackerPremium })))
const StaffManagement = lazy(() => import('./components/StaffManagement').then(module => ({ default: module.StaffManagement })))
const FetsVault = lazy(() => import('./components/FetsVault').then(module => ({ default: module.FetsVault })))
const FetsIntelligence = lazy(() => import('./components/FetsIntelligence').then(module => ({ default: module.FetsIntelligence })))
const FetsRoster = lazy(() => import('./components/FetsRosterPremium'))
const FetsCalendar = lazy(() => import('./components/FetsCalendarPremium').then(module => ({ default: module.FetsCalendarPremium })))
const ClientPortal = lazy(() => import('./components/ClientPortal').then(module => ({ default: module.ClientPortal })))
const SystemManager = lazy(() => import('./components/SystemManager').then(module => ({ default: module.default })))

const NewsManager = lazy(() => import('./components/NewsManager').then(module => ({ default: module.NewsManager })))
const UserManagement = lazy(() => import('./components/UserManagement').then(module => ({ default: module.UserManagement })))
const EnhancedChat = lazy(() => import('./components/Chat/TeamChatWorkspace').then(module => ({ default: module.TeamChatWorkspace })))
const RaiseACasePage = lazy(() => import('./components/RaiseACasePage').then(module => ({ default: module.RaiseACasePage })))

const FetsProfilePage = lazy(() => import('./components/FetsProfile').then(module => ({ default: module.FetsProfile })))
const BranchDelegationWidget = lazy(() => import('./components/BranchDelegationWidget').then(module => ({ default: module.BranchDelegationWidget })))
const GBPDashboard = lazy(() => import('./pages/GBPDashboard'))
const PearsonExpansionMission = lazy(() => import('./pages/PearsonExpansionMission').then(m => ({ default: m.PearsonExpansionMission })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

const getInitialTab = () => {
  if (typeof window === 'undefined') return 'command-center';
  const path = window.location.pathname.replace(/^\//, '').toLowerCase().trim();
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase().trim();
  const target = path || hash;
  if (target === 'roster' || target === 'fets-roster') return 'fets-roster';
  if (target === 'calendar' || target === 'fets-calendar') return 'fets-calendar';
  if (target === 'my-desk' || target === 'desk') return 'my-desk';
  if (target === 'actionables') return 'actionables';
  if (target === 'shift' || target === 'the-shift' || target === 'handover' || target === 'shift-handover') return 'handover';
  if (target === 'candidate-tracker' || target === 'tracker') return 'candidate-tracker';
  if (target === 'fets-intelligence' || target === 'intelligence' || target === 'ai') return 'fets-intelligence';
  if (target === 'incident-log' || target === 'incidents' || target === 'cases') return 'incident-log';
  if (target === 'user-management' || target === 'users') return 'user-management';
  if (target === 'system-manager' || target === 'systems') return 'system-manager';
  if (target === 'news-manager' || target === 'news') return 'news-manager';
  if (target === 'expansion' || target === 'pearson-expansion') return 'expansion';
  const known = ['profile', 'access-hub', 'dashboard', 'staff-management', 'fets-chat', 'chat', 'lost-and-found', 'branch-delegation', 'gbp', 'attn-admin', 'business', 'staff-ot', 'client-portal', 'news'];
  return known.includes(target) ? target : 'command-center';
};

const SHARED_WORKSPACE_PAGES = [
  'command-center', 'fets-calendar', 'fets-roster', 'my-desk', 'access-hub',
  'dashboard', 'candidate-tracker', 'fets-intelligence', 'incident-log',
  'system-manager', 'news-manager', 'user-management', 'branch-delegation',
  'gbp', 'attn-admin', 'business', 'staff-requests', 'staff-ot', 'handover',
  'news', 'actionables', 'fets-chat', 'chat', 'lost-and-found',
];

function AppContent() {
  const { user, loading, profile, signOut } = useAuth()
  const { activeBranch, setActiveBranch, getBranchTheme } = useBranch()
  const [activeTab, setActiveTabState] = useState(getInitialTab)

  const setActiveTab = (newTab: string) => {
    setActiveTabState(newTab);
    if (typeof window !== 'undefined') {
      const path = newTab === 'command-center' ? '/' :
                   newTab === 'fets-roster' ? '/roster' :
                   newTab === 'fets-calendar' ? '/calendar' :
                   newTab === 'my-desk' ? '/my-desk' :
                   newTab === 'handover' ? '/shift' :
                   newTab === 'expansion' ? '/expansion' : `/${newTab}`;
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path);
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const tab = getInitialTab();
      setActiveTabState(tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isMobile = useIsMobile()
  useNativeNavigation(activeTab, setActiveTab)
  const [isRecovering, setIsRecovering] = useState(false)
  const [aiQuery, setAiQuery] = useState<string | undefined>(undefined)
  const isMithun = isMithunEmail(profile?.email)
  const isAdmin = profile?.role === 'super_admin' || isMithun
  const userName = profile?.full_name || profile?.name || (profile?.email || user?.email || '').split('@')[0] || 'User'
  const userEmail = profile?.email || user?.email || ''

  const [hasDelegation, setHasDelegation] = useState(false)

  useEffect(() => {
    if (!user || !profile || profile.role === 'super_admin') {
      setHasDelegation(false)
      return
    }
    const checkDelegation = async () => {
      try {
        const nowIso = new Date().toISOString()
        const { data } = await supabase
          .from('staff_branch_delegations')
          .select('id')
          .eq('profile_id', profile.id)
          .lte('start_date', nowIso)
          .gte('end_date', nowIso)
        setHasDelegation(data && data.length > 0)
      } catch (e) {
        setHasDelegation(false)
      }
    }
    checkDelegation()
  }, [user, profile])



  const handleLogout = async () => {
    try { localStorage.removeItem('fets-session-start') } catch {}
    try { await signOut() } catch {}
    setActiveTab('command-center')
  }

  // Auto sign-out after a fixed session length (security: no indefinite sessions)
  useEffect(() => {
    const KEY = 'fets-session-start'
    if (!user) { try { localStorage.removeItem(KEY) } catch {}; return }
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, String(Date.now()))
    const MAX_MS = 4 * 60 * 60 * 1000 // 4 hours
    const check = () => {
      const start = Number(localStorage.getItem(KEY) || Date.now())
      if (Date.now() - start > MAX_MS) {
        try { localStorage.removeItem(KEY) } catch {}
        signOut()
      }
    }
    const id = setInterval(check, 60 * 1000)
    check()
    return () => clearInterval(id)
  }, [user, signOut])



  useEffect(() => {
    initializeNative(__FETS_ANDROID_PUSH_CONFIGURED__).catch(err => {
      console.error('Capacitor initialization failed:', err);
    });
  }, []);



  if (loading) return <BrandLoader fullScreen message="Getting your workspace ready" />;
  if (isRecovering) return <UpdatePassword onComplete={() => { setIsRecovering(false); window.location.hash = ''; }} />;
  if (!user) return <Login />;

  const renderContent = () => {
    // expansion has its own standalone render — exempt from RedesignShell
    if (activeTab === 'expansion') return (
      <LazyErrorBoundary routeName="Mission 7 · Pearson Expansion" onGoBack={() => setActiveTab('command-center')}>
        <Suspense fallback={<PageLoadingFallback pageName="Mission 7 · Expansion" />}>
          <PearsonExpansionMission staffName={userName} isAdmin={isAdmin} />
        </Suspense>
      </LazyErrorBoundary>
    );

    const isRedesignPage = SHARED_WORKSPACE_PAGES.includes(activeTab);

    if (isRedesignPage) {
      let subPage = "live";
      if (activeTab === 'fets-calendar') subPage = 'calendar';
      else if (activeTab === 'fets-roster') subPage = 'roster';
      else if (activeTab === 'my-desk') subPage = 'desk';
      else if (activeTab === 'command-center') subPage = 'live';
      else subPage = activeTab;

      return (
        <LazyErrorBoundary routeName="FETS · LIVE" onGoBack={() => setActiveTab('command-center')}>
          <Suspense fallback={<PageLoadingFallback pageName="FETS · LIVE" />}>
            <RedesignShell
              bridge={setActiveTab}
              userName={userName}
              userEmail={userEmail}
              isAdmin={isAdmin}
              onLogout={handleLogout}
              activeBranch={activeBranch}
              onBranchChange={setActiveBranch}
              profileBranch={profile?.branch_assigned}
              activeSubPage={subPage}
            />
          </Suspense>
        </LazyErrorBoundary>
      );
    }

    const routeComponents: { [key: string]: { component: JSX.Element; name: string } } = {
      'command-center-classic': { component: <CommandCentre onNavigate={setActiveTab} onAiQuery={(q: string) => { setAiQuery(q); setActiveTab('fets-intelligence'); }} />, name: 'FETS POINT' },
      'fets-calendar-demo': { component: isMithun ? <FetsCalendar /> : <CommandCentre onNavigate={setActiveTab} onAiQuery={(q: string) => { setAiQuery(q); setActiveTab('fets-intelligence'); }} />, name: 'CELPIP Calendar' },
      'client-portal': { component: isMithun ? <ClientPortal /> : <CommandCentre onNavigate={setActiveTab} onAiQuery={(q: string) => { setAiQuery(q); setActiveTab('fets-intelligence'); }} />, name: 'Client Portal' },
      'staff-management': { component: <StaffManagement />, name: 'Staff Management' },
      'fets-chat': { component: <EnhancedChat />, name: 'Live Chat & Gemini Studio' },
      'chat': { component: <EnhancedChat />, name: 'Live Chat & Gemini Studio' },
      'lost-and-found': { component: <EnhancedChat />, name: 'Live Chat & Gemini Studio' },
      'profile': { component: <FetsProfilePage />, name: 'Profile' },
    };

    const currentRoute = routeComponents[activeTab] || routeComponents['command-center-classic'];
    return (
      <LazyErrorBoundary routeName={currentRoute.name} onGoBack={() => setActiveTab('command-center')}>
        <Suspense fallback={<PageLoadingFallback pageName={currentRoute.name} />}>
          {currentRoute.component}
        </Suspense>
      </LazyErrorBoundary>
    );
  }

  const isFullscreenPage = ['fets-chat','chat','lost-and-found','actionables'].includes(activeTab) || activeTab === 'my-desk' || activeTab === 'fets-intelligence' || activeTab === 'command-center' || activeTab === 'fets-roster' || activeTab === 'fets-calendar' || activeTab === 'access-hub' || activeTab === 'dashboard' || activeTab === 'candidate-tracker' || activeTab === 'incident-log' || activeTab === 'system-manager' || activeTab === 'news-manager' || activeTab === 'user-management' || activeTab === 'branch-delegation' || activeTab === 'gbp' || activeTab === 'attn-admin' || activeTab === 'business' || activeTab === 'staff-requests' || activeTab === 'staff-ot' || activeTab === 'handover' || activeTab === 'news' || activeTab === 'expansion';

  return (
    <div className={`golden-theme min-h-screen h-screen flex flex-col overflow-hidden relative ${getBranchTheme(activeBranch)} ${(activeTab === 'fets-calendar' || activeTab === 'fets-calendar-demo') ? 'fets-calendar-active-page' : ''}`}>
      {isMobile && !isFullscreenPage && <div className="h-safe-top bg-[#1a3a3d] w-full flex-none" />}

      {!isFullscreenPage && !isMobile && (
        <div className="flex-none bg-[#e0e5ec] relative z-50">
          <WorkspaceNavigation navigate={setActiveTab} />
        </div>
      )}

      <div className={`flex-1 overflow-y-auto mobile-hide-scrollbar relative ${isFullscreenPage ? '' : (isMobile ? 'pt-0' : 'pt-4 px-4 md:px-8 pb-8')}`}>
        {isMobile && !SHARED_WORKSPACE_PAGES.includes(activeTab) ? (
          <div className="mobile-page-frame">
            <MobileHeader branch={activeBranch} onBranchChange={value => setActiveBranch(value as any)} navigate={id => setActiveTab(mobileToApp(id))} />
            <div className="mobile-page-content">{renderContent()}</div>
            <MobileNavigation onLogout={handleLogout} active={appToMobile(activeTab)} navigate={id => setActiveTab(mobileToApp(id))} />
          </div>
        ) : renderContent()}
      </div>

      <BranchIndicator />
      <FetsAIAgent userId={user!.id} branch={activeBranch} page={activeTab} navigate={setActiveTab} withMobileNav={isMobile} />





    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BranchProvider>
            <ThemeProvider>
              <ChatProvider>
                <CallProvider>
                  <AppContent />
                </CallProvider>
              </ChatProvider>
              <Toaster position="top-right" />
            </ThemeProvider>
          </BranchProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
