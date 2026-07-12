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
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { UpdatePassword } from './components/UpdatePassword';


import { BranchIndicator } from './components/BranchIndicator';


// DIRECT IMPORTS FOR MOBILE STABILITY (No Lazy Loading for Mobile)
import { MobileHome } from './components/MobileHome';
import { MobileCalendarView as MobileCalendar } from './components/MobileCalendarView';
import { MobileRegisterView as MobileRegister } from './components/MobileRegisterView';
import { MobileAiChat } from './components/MobileAiChat';
import { MobileIncidentManager } from './components/MobileIncidentManager';

import { supabase } from './lib/supabase';
import { useIsMobile, useScreenSize } from './hooks/use-mobile';
import { isMithunEmail } from './utils/authUtils';

// Capacitor Imports
import { App as CapacitorApp } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

// Lazy load Desktop components
const Dashboard = lazy(() => import('./components/iCloud/iCloudDashboard').then(module => ({ default: module.ICloudDashboard })))
const AccessHubPage = lazy(() => import('./components/AccessHub').then(module => ({ default: module.AccessHub })))
const CommandCentre = lazy(() => import('./components/CommandCentreFinal'))
const RedesignShell = lazy(() => import('./redesign/RedesignShell'))
const CandidateTracker = lazy(() => import('./components/CandidateTrackerPremium').then(module => ({ default: module.CandidateTrackerPremium })))
const MithunWorkbench = lazy(() => import('./components/MithunWorkbench').then(module => ({ default: module.MithunWorkbench })))
const StaffManagement = lazy(() => import('./components/StaffManagement').then(module => ({ default: module.StaffManagement })))
const FetsVault = lazy(() => import('./components/FetsVault').then(module => ({ default: module.FetsVault })))
const FetsIntelligence = lazy(() => import('./components/FetsIntelligence').then(module => ({ default: module.FetsIntelligence })))
const FetsRoster = lazy(() => import('./components/FetsRosterPremium'))
const FetsCalendar = lazy(() => import('./components/FetsCalendarPremium').then(module => ({ default: module.FetsCalendarPremium })))
const ClientPortal = lazy(() => import('./components/ClientPortal').then(module => ({ default: module.ClientPortal })))
const SystemManager = lazy(() => import('./components/SystemManager').then(module => ({ default: module.default })))

const NewsManager = lazy(() => import('./components/NewsManager').then(module => ({ default: module.NewsManager })))
const UserManagement = lazy(() => import('./components/UserManagement').then(module => ({ default: module.UserManagement })))
const LostAndFound = lazy(() => import('./components/LostAndFound').then(module => ({ default: module.LostAndFound })))
const RaiseACasePage = lazy(() => import('./components/RaiseACasePage').then(module => ({ default: module.RaiseACasePage })))

const FetsProfilePage = lazy(() => import('./components/FetsProfile').then(module => ({ default: module.FetsProfile })))
const BranchDelegationWidget = lazy(() => import('./components/BranchDelegationWidget').then(module => ({ default: module.BranchDelegationWidget })))
const GBPDashboard = lazy(() => import('./pages/GBPDashboard'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

function AppContent() {
  const { user, loading, profile, signOut } = useAuth()
  const { activeBranch, setActiveBranch, getBranchTheme } = useBranch()
  const [activeTab, setActiveTab] = useState('command-center')
  const isMobile = useIsMobile()
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
    const setupPush = async () => {
      try {
        const info = await Device.getInfo();
        if (info.platform === 'web') return;
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#FACC15' });
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive !== 'granted') perm = await PushNotifications.requestPermissions();
        if (perm.receive === 'granted') await PushNotifications.register();
      } catch (err) {
        console.error('❌ Capacitor init error:', err);
      }
    };
    setupPush();
  }, []);



  if (loading) return null;
  if (isRecovering) return <UpdatePassword onComplete={() => { setIsRecovering(false); window.location.hash = ''; }} />;
  if (!user) return <Login />;

  const renderContent = () => {
    if (isMobile) {      if (activeTab === 'command-center' || activeTab === 'fets-calendar' || activeTab === 'fets-roster' || activeTab === 'my-desk') return (
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
            activeSubPage={
              activeTab === 'command-center' ? 'live' :
              activeTab === 'fets-calendar' ? 'calendar' :
              activeTab === 'fets-roster' ? 'roster' : 'desk'
            }
          />
        </Suspense>
      );
      if (activeTab === 'fets-calendar-demo') return isMithun ? <FetsCalendar /> : <MobileHome setActiveTab={setActiveTab} profile={profile} />;
      if (activeTab === 'client-portal') return isMithun ? <ClientPortal /> : <MobileHome setActiveTab={setActiveTab} profile={profile} />;
      if (activeTab === 'candidate-tracker') return <MobileRegister />;
      if (activeTab === 'fets-intelligence') return <MobileAiChat />;
      if (activeTab === 'incident-log') return <MobileIncidentManager />;
      if (activeTab === 'access-hub') return <AccessHubPage />;
      if (activeTab === 'user-management') return <UserManagement onNavigate={setActiveTab} />;
      if (activeTab === 'profile') return <FetsProfilePage />;
 
      if (activeTab === 'system-manager') return <SystemManager />;
      if (activeTab === 'news-manager') return <NewsManager />;
      if (activeTab === 'lost-and-found') return <LostAndFound />;
      if (activeTab === 'cma-availability' || activeTab === 'branch-delegation') return isMithun ? <BranchDelegationWidget /> : <MobileHome setActiveTab={setActiveTab} profile={profile} />;
      if (activeTab === 'gbp') return <GBPDashboard />;
    }

    const isRedesignPage = [
      'command-center', 'fets-calendar', 'fets-roster', 'my-desk',
      'access-hub', 'dashboard', 'candidate-tracker', 'fets-intelligence',
      'incident-log', 'system-manager', 'news-manager', 'user-management',
      'branch-delegation', 'gbp', 'attn-admin', 'business', 'staff-requests', 'staff-ot'
    ].includes(activeTab);

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
      'lost-and-found': { component: <LostAndFound />, name: 'Lost & Found' },
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

  const isFullscreenPage = activeTab === 'my-desk' || activeTab === 'fets-intelligence' || activeTab === 'command-center' || activeTab === 'fets-roster' || activeTab === 'fets-calendar' || activeTab === 'access-hub' || activeTab === 'dashboard' || activeTab === 'candidate-tracker' || activeTab === 'incident-log' || activeTab === 'system-manager' || activeTab === 'news-manager' || activeTab === 'user-management' || activeTab === 'branch-delegation' || activeTab === 'gbp' || activeTab === 'attn-admin' || activeTab === 'business' || activeTab === 'staff-requests' || activeTab === 'staff-ot';

  return (
    <div className={`golden-theme min-h-screen h-screen flex flex-col overflow-hidden relative ${getBranchTheme(activeBranch)} ${(activeTab === 'fets-calendar' || activeTab === 'fets-calendar-demo') ? 'fets-calendar-active-page' : ''}`}>
      {isMobile && !isFullscreenPage && <div className="h-safe-top bg-[#1a3a3d] w-full flex-none" />}

      {!isFullscreenPage && !isMobile && (
        <div className="flex-none bg-[#e0e5ec] relative z-50">
          <Header isMobile={isMobile} setActiveTab={setActiveTab} activeTab={activeTab} />
        </div>
      )}

      <div className={`flex-1 overflow-y-auto mobile-hide-scrollbar relative ${isFullscreenPage ? '' : (isMobile ? 'pt-0' : 'pt-4 px-4 md:px-8 pb-8')}`}>
        {renderContent()}
      </div>

      <BranchIndicator />


      {isMobile && !isFullscreenPage && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}


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
