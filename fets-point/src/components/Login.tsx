import { useCallback, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { ArrowRight, ArrowUpRight, Eye, EyeOff, LockKeyhole, Mail, Wind } from 'lucide-react';
import { BrandSculpture, WelcomeIntro } from '../redesign/BrandExperience';
import '../redesign/premium-experience.css';

function shouldShowIntro() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return false;
  try { return sessionStorage.getItem('fets-welcome-seen') !== '1'; } catch { return true; }
}
export function Login() {
  const { signIn } = useAuth();
  const [intro, setIntro] = useState(shouldShowIntro);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false); const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState(''); const [resetMessage, setResetMessage] = useState('');
  const [quiet, setQuiet] = useState(false);
  const finishIntro = useCallback(() => { try { sessionStorage.setItem('fets-welcome-seen', '1'); } catch { /* Login also works without storage. */ } setIntro(false); }, []);
  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault(); if (loading) return; setLoading(true); setError('');
    try { const result = await signIn(email.trim(), password); if (result.error) setError(result.error.message); }
    catch (err: unknown) { setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Unable to connect. Check your connection and try again.'); }
    finally { setLoading(false); }
  };
  const handleRecovery = async (event: React.FormEvent) => {
    event.preventDefault(); if (loading) return; setLoading(true); setError(''); setResetMessage('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), { redirectTo: `${window.location.origin}/update-password` });
      if (resetError) throw resetError;
      setResetMessage('If this email is registered, you’ll receive a recovery link. Check your inbox.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Could not send the recovery link. Please try again.'); }
    finally { setLoading(false); }
  };
  if (intro) return <WelcomeIntro onComplete={finishIntro} />;
  return <main className={`premium-login${quiet ? ' premium-login--quiet' : ''}`}>
    <div className="login-ambient login-ambient--one" /><div className="login-ambient login-ambient--two" />
    <header className="login-masthead"><a href="/" className="login-brand" aria-label="FETS LIVE home">fets<span>.</span>live</a><span className="premium-eyebrow">YOUR PEOPLE. YOUR PLACE.</span></header>
    <div className="login-layout">
      <section className="login-story" aria-label="Welcome to your workspace">
        <span className="premium-eyebrow"><i /> A LITTLE MORE HUMAN. A LOT MORE CONNECTED.</span>
        <h1>Great days.<br /><em>Made together.</em></h1>
        <p>Behind every confident candidate,<br className="login-desktop-break" /> there’s a team that cares. This is your space.</p>
        <div className="login-sculpture-wrap"><BrandSculpture /><span className="login-art-note">People at the centre.<br /><em>Always.</em></span></div>
        <div className="login-story-footer"><span className="login-centres">COCHIN <i /> CALICUT <span>ONE TEAM</span></span><button className="login-quiet" onClick={() => setQuiet(q => !q)} aria-pressed={quiet}><Wind size={15} />{quiet ? 'A little quieter' : 'A moment of calm'}</button></div>
      </section>
      <section className="login-card" aria-label={showForgot ? 'Account recovery' : 'Sign in'}>
        <div className="login-card-top"><span className="login-monogram">f.</span><span className="premium-eyebrow">{showForgot ? 'FIND YOUR WAY BACK' : 'THE DAY IS YOURS'}</span><ArrowUpRight size={18} /></div>
        <div className="login-card-heading"><h2>{showForgot ? 'A fresh start.' : 'Welcome back.'}</h2><p>{showForgot ? 'We’ll help you get back to your workspace.' : 'Come in. Find your rhythm. Make a difference.'}</p></div>
        <form onSubmit={showForgot ? handleRecovery : handleSignIn} aria-busy={loading}>
          {error && <div className="login-message login-message--error" role="alert">{error}</div>}
          {resetMessage && <div className="login-message" role="status">{resetMessage}</div>}
          <label className="login-label" htmlFor="login-email">Work email</label>
          <div className="login-input-wrap"><Mail size={17} /><input id="login-email" type="email" name="email" autoComplete="username" placeholder="you@fets.in" value={showForgot ? resetEmail : email} onChange={e => showForgot ? setResetEmail(e.target.value) : setEmail(e.target.value)} required disabled={loading} autoCapitalize="none" spellCheck={false} /></div>
          {!showForgot && <><div className="login-password-label"><label className="login-label" htmlFor="login-password">Password</label><button type="button" disabled={loading} onClick={() => { setResetEmail(email); setShowForgot(true); setError(''); }}>Forgot password?</button></div>
            <div className="login-input-wrap"><LockKeyhole size={17} /><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} required disabled={loading} /><button type="button" className="login-reveal" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></>}
          <button className="login-submit" disabled={loading} type="submit"><span>{loading ? (showForgot ? 'Sending recovery link…' : 'Opening your workspace…') : (showForgot ? 'Send recovery link' : 'Step inside')}</span>{loading ? <span className="login-spinner" aria-hidden="true" /> : <ArrowRight size={19} />}</button>
          {showForgot && <button className="login-back" type="button" disabled={loading} onClick={() => { setShowForgot(false); setError(''); setResetMessage(''); }}>← Back to sign in</button>}
        </form>
        <div className="login-card-foot"><span className="login-foot-dot" /><p>A space for good work.<br /><strong>And the people who make it happen.</strong></p></div>
      </section>
    </div>
    <footer className="login-footer"><span>FETS LIVE <i> / </i> THE HUMAN SIDE OF OPERATIONS</span><span>Every detail. Every day. Together.</span></footer>
  </main>;
}
