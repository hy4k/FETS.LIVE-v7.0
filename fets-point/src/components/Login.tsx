import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Stage = 'credentials' | 'launching'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()

  const [stage, setStage] = useState<Stage>('credentials')
  const [resetEmail, setResetEmail] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    setStage('launching')
    try {
      const { error } = await signIn(email, password)
      if (error) { setError(error.message); setStage('credentials') }
    } catch (err: any) {
      setError(err.message === 'Failed to fetch' ? 'Network error — please check your connection.' : (err.message || 'Login failed'))
      setStage('credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) return
    setLoading(true)
    setResetMessage(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: `${window.location.origin}/update-password` })
      if (error) throw error
      setResetMessage({ type: 'success', text: 'Recovery link sent — check your inbox.' })
    } catch (err: any) {
      setResetMessage({ type: 'error', text: err.message || 'Something went wrong' })
    } finally {
      setLoading(false)
    }
  }

  const fade = {
    initial: { opacity: 0, y: 22, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, y: -16, filter: 'blur(6px)', transition: { duration: 0.35 } },
  }

  const inputClass =
    'w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/25 rounded-2xl text-white text-sm font-semibold ' +
    'placeholder-white/40 focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all duration-300 ' +
    'shadow-sm focus:ring-2 focus:ring-white/20'

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-5" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* warm gold ambient background */}
      <motion.div className="absolute inset-0 z-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.1 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#F7D046] via-[#F0C027] to-[#E2A80D]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.22)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(180,120,0,0.2)_0%,transparent_50%)]" />
        <motion.div animate={{ y: [-40, 40, -40], x: [-25, 25, -25], scale: [1, 1.08, 1] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[8%] right-[12%] w-[340px] h-[340px] rounded-full bg-white/[0.09] blur-2xl" />
        <motion.div animate={{ y: [30, -30, 30], x: [15, -25, 15], scale: [1, 1.12, 1] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-[12%] left-[8%] w-[300px] h-[300px] rounded-full bg-white/[0.07] blur-xl" />
        <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.4) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      </motion.div>

      {/* single centered card */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
        className="relative z-10 w-full max-w-[400px] rounded-[32px] border border-white/35 bg-white/12 px-8 py-12 backdrop-blur-2xl shadow-[0_32px_90px_rgba(120,80,0,0.28)]"
      >
        {/* logo + name */}
        <div className="flex flex-col items-center gap-4 mb-9">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <span className="text-[#E2A80D]" style={{ fontFamily: '"Archivo Expanded", Inter, sans-serif', fontWeight: 900, fontSize: 38, lineHeight: 1, letterSpacing: '-0.04em' }}>F</span>
          </div>
          <h1 className="text-white font-black tracking-[-0.04em] leading-none" style={{ fontSize: 38 }}>
            fets<span className="opacity-50">.</span>live
          </h1>
        </div>

        <AnimatePresence mode="wait">
          {stage === 'credentials' && !showForgot && (
            <motion.form key="creds" onSubmit={handleSignIn} className="space-y-4" {...fade}>
              {error && (
                <div className="px-4 py-3 bg-red-600/30 border border-red-500/40 rounded-xl text-white text-xs font-bold leading-relaxed">{error}</div>
              )}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="User ID" autoComplete="username" required autoFocus />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Password" autoComplete="current-password" required />
              </div>
              <button type="submit" disabled={loading}
                className="w-full mt-2 py-4 bg-white text-[#9A6A00] font-black uppercase tracking-wider text-xs rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <div className="w-5 h-5 border-2 border-amber-300 border-t-[#9A6A00] rounded-full animate-spin" /> : (<>Sign In <ArrowRight size={14} className="opacity-80" /></>)}
              </button>
              <button type="button" onClick={() => setShowForgot(true)} className="w-full pt-1 text-white/45 text-[11px] font-bold hover:text-white/80 transition-colors">
                Forgot password?
              </button>
            </motion.form>
          )}

          {stage === 'credentials' && showForgot && (
            <motion.form key="forgot" onSubmit={handleForgotPassword} className="space-y-4" {...fade}>
              {resetMessage && (
                <div className={`px-4 py-3 rounded-xl border text-xs font-bold leading-relaxed ${resetMessage.type === 'success' ? 'bg-green-600/30 border-green-500/40 text-white' : 'bg-red-600/30 border-red-500/40 text-white'}`}>{resetMessage.text}</div>
              )}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/40" />
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className={inputClass} placeholder="User ID" required autoFocus />
              </div>
              <button type="submit" disabled={loading} className="w-full py-4 bg-white text-[#9A6A00] font-black uppercase tracking-wider text-xs rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center">
                {loading ? <div className="w-5 h-5 border-2 border-amber-300 border-t-[#9A6A00] rounded-full animate-spin" /> : 'Send Recovery Link'}
              </button>
              <button type="button" onClick={() => setShowForgot(false)} className="w-full py-1 text-white/55 text-[11px] font-bold hover:text-white/80 transition-colors">← Back</button>
            </motion.form>
          )}

          {stage === 'launching' && (
            <motion.div key="launching" className="flex flex-col items-center justify-center text-center py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="w-12 h-12 border-[3px] border-white/20 border-t-white rounded-full animate-spin mb-5" />
              <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Signing in…</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>
    </div>
  )
}
