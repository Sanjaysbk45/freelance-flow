import { useEffect, useRef, useState } from 'react';
import api from '../api';

// Monochrome robot face — inherits color from `currentColor`, no fills of its own.
export function RobotIcon({ className = 'h-7 w-7' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3v2.5" />
      <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
      <rect x="4" y="5.5" width="16" height="13" rx="3.5" />
      <path d="M2 10.5v3M22 10.5v3" />
      <circle cx="9" cy="11.5" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11.5" r="1.25" fill="currentColor" stroke="none" />
      <path d="M9.5 15.5h5" />
    </svg>
  );
}

const SUGGESTIONS = [
  'How much is outstanding?',
  'List my active projects',
  'How many hours total?',
  "What's due soon?",
];

export default function ChatAssistant({ open, setOpen }) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: "Hi! I'm your FreelanceFlow assistant. Ask me about your hours, invoices, projects, clients or deadlines.",
    },
  ]);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, busy]);

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    try {
      const { data } = await api.post('/assistant', { message: text });
      setMessages((m) => [...m, { role: 'bot', text: data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'bot', text: 'Sorry, I had trouble reaching the server. Please try again.' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 left-5 z-[60] flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/12 bg-slate-900/80 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl md:bottom-24">
          <div
            className="flex items-center gap-2 px-4 py-3 text-slate-900"
            style={{ backgroundImage: 'linear-gradient(135deg, #3ef2a0, #38bdf8)' }}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900/15 text-slate-900">
              <RobotIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="font-display text-sm font-bold leading-tight">FlowBot</div>
              <div className="text-[11px] opacity-80">Data + knowledge assistant</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-slate-900/70 transition hover:bg-slate-900/15 hover:text-slate-900"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-gradient-to-br from-sky-400 to-violet-400 text-slate-900'
                      : 'rounded-bl-sm border border-white/10 bg-white/5 text-slate-100'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
                  …thinking
                </div>
              </div>
            )}
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-white/10 p-3"
          >
            <input
              className="input flex-1 py-2 text-sm"
              placeholder="Ask about your data…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
              style={{ backgroundImage: 'linear-gradient(135deg, #3ef2a0, #38bdf8)' }}
              disabled={busy || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
