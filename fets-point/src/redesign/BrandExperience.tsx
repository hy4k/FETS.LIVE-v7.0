import { useEffect, useState, type PointerEvent } from 'react';
import './premium-experience.css';

/** A lightweight, dimensional brand sculpture. No canvas, video or render loop. */
export function BrandSculpture({ compact = false }: { compact?: boolean }) {
  const tilt = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--tilt-x', `${(event.clientY - box.top - box.height / 2) / box.height * -12}deg`);
    event.currentTarget.style.setProperty('--tilt-y', `${(event.clientX - box.left - box.width / 2) / box.width * 12}deg`);
  };
  return <div className={`brand-sculpture${compact ? ' brand-sculpture--compact' : ''}`} aria-hidden="true" onPointerMove={tilt} onPointerLeave={event => { event.currentTarget.style.setProperty('--tilt-x', '0deg'); event.currentTarget.style.setProperty('--tilt-y', '0deg'); }}>
    <div className="brand-sculpture-shadow" />
    <div className="brand-sculpture-object">
      <div className="brand-orbit brand-orbit--sage" /><div className="brand-orbit brand-orbit--pearl" /><div className="brand-orbit brand-orbit--lilac" />
      <div className="brand-core"><span>f.</span><i /></div>
      <span className="brand-satellite brand-satellite--one" /><span className="brand-satellite brand-satellite--two" />
    </div>
  </div>;
}

export function BrandLoader({ message = 'Opening your workspace', fullScreen = false }: { message?: string; fullScreen?: boolean }) {
  return <div className={`brand-loader${fullScreen ? ' brand-loader--full' : ''}`} role="status">
    <BrandSculpture compact /><span className="brand-wordmark">fets<span>.</span>live</span>
    <p>{message}</p><div className="brand-loading-line" aria-hidden="true"><span /></div>
  </div>;
}

export function WelcomeIntro({ onComplete }: { onComplete: () => void }) {
  useEffect(() => { const timer = window.setTimeout(onComplete, 1900); return () => clearTimeout(timer); }, [onComplete]);
  return <section className="welcome-intro" aria-label="Welcome to FETS LIVE">
    <span className="premium-eyebrow">PEOPLE. PRECISION. POSSIBILITY.</span>
    <BrandSculpture /><h1 className="brand-wordmark">fets<span>.</span>live</h1>
    <p>A little more connected. A lot more possible.</p>
    <button className="intro-skip" onClick={onComplete}>Continue to sign in <span aria-hidden="true">↗</span></button>
  </section>;
}

/** Isolated ticking clock: seconds never trigger an operations-data fetch. */
export function CentreClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => { if (!document.hidden) setNow(new Date()); };
    const interval = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', update); };
  }, []);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return <div className="centre-clock">
    <div className="centre-clock-caption"><span className="premium-eyebrow">A MOMENT IN YOUR DAY</span><span>IST · UTC +5:30</span></div>
    <time dateTime={now.toISOString()} aria-label={`India time ${part('hour')}:${part('minute')}:${part('second')}`}><span>{part('hour')}<i>:</i>{part('minute')}</span><small>{part('second')}</small></time>
    <span className="centre-clock-date">{now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
  </div>;
}

export function PersonalHero({ name, branch, onDesk }: { name: string; branch: string; onDesk: () => void }) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return <header className="personal-hero">
    <div className="hero-haze hero-haze--sage" /><div className="hero-haze hero-haze--lilac" />
    <div className="personal-hero-top"><span className="premium-eyebrow">THE PEOPLE BEHIND EVERY POSSIBILITY</span><span className="hero-centre"><i />{branch}</span></div>
    <div className="personal-hero-copy"><div className="hero-wordmark" aria-label="FETS LIVE">fets<span>.</span>live</div>
      <p className="hero-greeting">{greeting},</p><h1>{name || 'Welcome'}{!/[.!?]$/.test(name) && <span>.</span>}</h1>
      <p className="hero-note">Good work starts with you. Let’s make today count.</p>
      <button className="hero-desk-button" onClick={onDesk}>Find your focus <span aria-hidden="true">↗</span></button>
    </div>
    <div className="personal-hero-art"><BrandSculpture /><span className="hero-art-caption"><span /> INDIVIDUALLY BRILLIANT. BETTER TOGETHER.</span></div>
    <CentreClock />
  </header>;
}
