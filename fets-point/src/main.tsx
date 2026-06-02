import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import PrivacyPolicy from './components/PrivacyPolicy.tsx'
import './index.css'
import './styles/app-shell.css'
import './styles/fets-enhancements.css'
import './styles/seven-day-calendar.css'
import './styles/bold-sidebar.css'
import './styles/command-centre-premium.css'

const isPrivacyPolicy = window.location.pathname === '/privacy-policy' || window.location.pathname === '/privacy';

// DEV PREVIEW ONLY — review the ported redesign without logging in.
// Visit /redesign-preview. Safe to delete this block (and the import below).
const isRedesignPreview = window.location.pathname === '/redesign-preview';
const RedesignPreview = lazy(() => import('./redesign/RedesignShell'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isRedesignPreview
      ? <Suspense fallback={null}><RedesignPreview bridge={() => {}} /></Suspense>
      : isPrivacyPolicy ? <PrivacyPolicy /> : <App />}
  </StrictMode>,
)