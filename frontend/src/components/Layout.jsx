import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTimer, formatElapsed } from '../context/TimerContext';
import ChatAssistant, { RobotIcon } from './ChatAssistant';

const nav = [
  { to: '/', label: 'Dashboard', icon: '◉', end: true },
  { to: '/clients', label: 'Clients', icon: '👥' },
  { to: '/projects', label: 'Projects', icon: '🗂️' },
  { to: '/time', label: 'Time Tracking', icon: '⏱️' },
  { to: '/invoices', label: 'Invoices', icon: '🧾' },
];

export default function Layout({ children }) {
  const { user, logout, setPlan } = useAuth();
  const { timer, active, running, elapsed, pause, resume, stop } = useTimer();
  const [chatOpen, setChatOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-white/[0.03] p-5 text-slate-300 backdrop-blur-xl md:flex">
          <div className="mb-10 flex items-center gap-2.5 px-1">
            <span className="grid h-10 w-10 place-items-center rounded-xl font-display text-lg font-bold text-slate-900 shadow-[0_8px_20px_-6px_rgba(56,189,248,0.7)]" style={{ backgroundImage: 'linear-gradient(135deg, #3ef2a0, #38bdf8)' }}>
              F
            </span>
            <span className="font-display text-lg font-bold text-white">FreelanceFlow</span>
          </div>

          <nav className="space-y-1.5">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-400/20 to-violet-400/20 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <span className="text-base">{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto space-y-3">
            <button
              onClick={() => setChatOpen((o) => !o)}
              aria-label="Open assistant"
              className="flex w-full items-center gap-3 rounded-xl border-2 border-[var(--sky)] bg-slate-900/60 px-3 py-2.5 text-sm font-semibold text-slate-100 shadow-[0_0_18px_-4px_rgba(56,189,248,0.6)] transition hover:-translate-y-0.5"
            >
              <RobotIcon className="h-6 w-6 shrink-0" />
              Ask FlowBot
            </button>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
              <div className="font-semibold text-white">{user?.name}</div>
              <div className="text-[var(--lime)]">
                {user?.plan === 'pro' ? '★ Pro plan' : 'Free plan'}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          {/* Persistent timer bar with pause / resume / stop. */}
          {active && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-2.5 text-sm text-slate-900" style={{ backgroundImage: 'linear-gradient(135deg, #3ef2a0, #38bdf8)' }}>
              <span className="flex items-center gap-2 font-semibold">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    running ? 'animate-pulse bg-rose-600' : 'bg-slate-900/40'
                  }`}
                />
                {running ? 'Tracking' : 'Paused'} · <strong>{timer?.projectName}</strong> ·
                <span className="font-mono tabular-nums">{formatElapsed(elapsed)}</span>
              </span>
              <span className="flex gap-2">
                {running ? (
                  <button
                    onClick={pause}
                    className="rounded-lg bg-slate-900/90 px-3 py-1 font-semibold text-white transition hover:bg-slate-900"
                  >
                    ⏸ Pause
                  </button>
                ) : (
                  <button
                    onClick={resume}
                    className="rounded-lg bg-slate-900/90 px-3 py-1 font-semibold text-white transition hover:bg-slate-900"
                  >
                    ▶ Resume
                  </button>
                )}
                <button
                  onClick={stop}
                  className="rounded-lg bg-white px-3 py-1 font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  ⏹ Stop &amp; Save
                </button>
              </span>
            </div>
          )}

          <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-6 py-3 backdrop-blur-xl">
            <div className="font-display text-sm text-slate-400">
              Welcome back, <span className="font-semibold text-white">{user?.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`badge ${
                  user?.plan === 'pro'
                    ? 'text-slate-900'
                    : 'border border-white/15 bg-white/5 text-slate-200'
                }`}
                style={user?.plan === 'pro' ? { backgroundImage: 'linear-gradient(135deg, #3ef2a0, #38bdf8)' } : undefined}
              >
                {user?.plan === 'pro' ? '★ PRO' : 'FREE'}
              </span>
              {user?.plan === 'free' ? (
                <button onClick={() => setPlan('pro')} className="btn-primary px-4 py-1.5 text-xs">
                  Upgrade
                </button>
              ) : (
                <button onClick={() => setPlan('free')} className="btn-ghost px-4 py-1.5 text-xs">
                  Downgrade
                </button>
              )}
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="btn-ghost px-4 py-1.5 text-xs"
              >
                Logout
              </button>
            </div>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>

      {/* Mobile launcher (sidebar is hidden on small screens). */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          aria-label="Open assistant"
          className="fixed bottom-5 left-5 z-[60] grid h-14 w-14 place-items-center rounded-2xl border-2 border-[var(--sky)] bg-slate-900/70 text-slate-100 shadow-[0_0_20px_-2px_rgba(56,189,248,0.7)] backdrop-blur-xl transition-transform hover:-translate-y-1 md:hidden"
        >
          <RobotIcon className="h-8 w-8" />
        </button>
      )}

      <ChatAssistant open={chatOpen} setOpen={setChatOpen} />
    </div>
  );
}
