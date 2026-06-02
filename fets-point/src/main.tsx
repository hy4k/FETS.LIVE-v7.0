import { StrictMode } from 'react'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPrivacyPolicy ? <PrivacyPolicy /> : <App />}
  </StrictMode>,
)