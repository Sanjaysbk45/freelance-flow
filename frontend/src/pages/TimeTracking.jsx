import { useEffect, useState } from 'react';
import api from '../api';
import { useTimer, formatElapsed } from '../context/TimerContext';

export default function TimeTracking() {
  const { timer, elapsed, active, running, start, pause, resume, reset, cancel, stop } = useTimer();
  const [projects, setProjects] = useState([]);
  const [logs, setLogs] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [desc, setDesc] = useState('');
  const [manual, setManual] = useState({ project_id: '', hours: '', description: '', date: '' });

  const load = () => {
    api.get('/projects').then((r) => setProjects(r.data));
    api.get('/timelogs').then((r) => setLogs(r.data));
  };
  useEffect(load, [active]);

  const handleStart = () => {
    const p = projects.find((x) => String(x.id) === String(projectId));
    if (!p) return alert('Select a project first');
    start(p.id, `${p.name} — ${p.client_name}`, desc);
    setDesc('');
  };

  const handleStop = async () => {
    await stop();
    load();
  };

  const addManual = async (e) => {
    e.preventDefault();
    await api.post('/timelogs/manual', { ...manual, hours: Number(manual.hours) });
    setManual({ project_id: '', hours: '', description: '', date: '' });
    load();
  };

  const removeLog = async (id) => {
    await api.delete(`/timelogs/${id}`);
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Time Tracking</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stopwatch */}
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Stopwatch</h2>
            {active && (
              <span
                className={`badge ${
                  running ? 'bg-[var(--lime)] text-black' : 'bg-[var(--coral)] text-black'
                }`}
              >
                {running ? '● Running' : '❙❙ Paused'}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 py-6 text-center shadow-[inset_0_0_30px_rgba(56,189,248,0.15)]">
            <div className="font-mono text-6xl font-bold tabular-nums text-[var(--sky)]" style={{ textShadow: '0 0 18px rgba(56,189,248,0.7)' }}>
              {formatElapsed(elapsed)}
            </div>
            {active && <div className="mt-2 text-sm font-medium text-slate-300">{timer.projectName}</div>}
          </div>

          {!active ? (
            <div className="space-y-3">
              <select
                className="input"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Choose project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.client_name}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="What are you working on?"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <button onClick={handleStart} className="btn-primary w-full">
                ▶ Start Timer
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                {running ? (
                  <button
                    onClick={pause}
                    title="Pause"
                    className="icon-btn bg-[var(--coral)]"
                  >
                    ⏸
                  </button>
                ) : (
                  <button
                    onClick={resume}
                    title="Resume"
                    className="icon-btn bg-[var(--lime)]"
                  >
                    ▶
                  </button>
                )}
                <button
                  onClick={reset}
                  title="Reset to 00:00:00"
                  className="icon-btn bg-[var(--sky)]"
                >
                  ↺
                </button>
                <button
                  onClick={cancel}
                  title="Discard"
                  className="icon-btn bg-white"
                >
                  ✕
                </button>
              </div>
              <button onClick={handleStop} className="btn-accent w-full">
                ⏹ Stop &amp; Save
              </button>
            </div>
          )}

          <p className="text-center text-xs text-slate-400">
            Pause, reset, or discard anytime. The timer keeps running across pages and page
            refreshes.
          </p>
        </div>

        {/* Manual entry */}
        <form onSubmit={addManual} className="card space-y-3">
          <h2 className="font-display text-lg font-semibold">Manual Entry</h2>
          <select
            className="input"
            value={manual.project_id}
            onChange={(e) => setManual({ ...manual, project_id: e.target.value })}
            required
          >
            <option value="">Project *</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.client_name}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            step="0.25"
            placeholder="Hours worked * (e.g. 3)"
            value={manual.hours}
            onChange={(e) => setManual({ ...manual, hours: e.target.value })}
            required
          />
          <input
            className="input"
            type="date"
            value={manual.date}
            onChange={(e) => setManual({ ...manual, date: e.target.value })}
          />
          <input
            className="input"
            placeholder="Description"
            value={manual.description}
            onChange={(e) => setManual({ ...manual, description: e.target.value })}
          />
          <button className="btn-dark w-full">Log Hours</button>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-4 font-display text-lg font-semibold">Recent Logs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="pb-2">Project</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Date</th>
                <th className="pb-2 text-right">Hours</th>
                <th className="pb-2 text-center">Billed</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {logs.filter((l) => l.end_time).length === 0 && (
                <tr>
                  <td colSpan="6" className="py-4 text-center text-slate-400">
                    No time logs yet.
                  </td>
                </tr>
              )}
              {logs
                .filter((l) => l.end_time)
                .map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2">{l.project_name}</td>
                    <td className="py-2 text-slate-500">{l.description || '—'}</td>
                    <td className="py-2 text-slate-500">
                      {new Date(l.start_time).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-right">{(l.duration_minutes / 60).toFixed(2)}</td>
                    <td className="py-2 text-center">
                      {l.billed ? (
                        <span className="badge bg-slate-100 text-slate-500">billed</span>
                      ) : (
                        <span className="badge bg-emerald-100 text-emerald-700">unbilled</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {!l.billed && (
                        <button
                          onClick={() => removeLog(l.id)}
                          className="text-xs text-rose-500 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
