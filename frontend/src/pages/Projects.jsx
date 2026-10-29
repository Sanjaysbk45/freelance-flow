import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ client_id: '', name: '', budget: '', status: 'active' });
  const [detail, setDetail] = useState(null); // { project, logs, invoices }

  const load = () => {
    api.get('/projects').then((r) => setProjects(r.data));
    api.get('/clients').then((r) => setClients(r.data));
  };
  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault();
    await api.post('/projects', { ...form, budget: Number(form.budget) || 0 });
    setForm({ client_id: '', name: '', budget: '', status: 'active' });
    load();
  };

  const toggleStatus = async (p) => {
    await api.put(`/projects/${p.id}`, {
      status: p.status === 'active' ? 'completed' : 'active',
    });
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this project?')) return;
    await api.delete(`/projects/${id}`);
    load();
  };

  // Open the details panel: pull the project, its time logs, and the
  // client's invoices in parallel.
  const openDetails = async (p) => {
    const [project, logs, invoices] = await Promise.all([
      api.get(`/projects/${p.id}`).then((r) => r.data),
      api.get('/timelogs', { params: { project_id: p.id } }).then((r) => r.data),
      api.get('/invoices').then((r) => r.data.filter((i) => i.client_id === p.client_id)),
    ]);
    setDetail({ project, logs: logs.filter((l) => l.end_time), invoices });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Projects</h1>

      <form onSubmit={save} className="card grid gap-3 sm:grid-cols-5">
        <select
          className="input"
          value={form.client_id}
          onChange={(e) => setForm({ ...form, client_id: e.target.value })}
          required
        >
          <option value="">Client *</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className="input sm:col-span-2"
          placeholder="Project name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="input"
          type="number"
          placeholder="Budget"
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
        />
        <button className="btn-primary">+ Add Project</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.length === 0 && (
          <div className="card text-sm text-slate-400">No projects yet.</div>
        )}
        {projects.map((p) => (
          <div key={p.id} className="card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">{p.client_name}</div>
              </div>
              <span
                className={`badge ${
                  p.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {p.status}
              </span>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>
                  Burn: {money(p.logged_cost)} / {money(p.budget)}
                </span>
                <span>{p.burn_rate}%</span>
              </div>
              <div className="h-3 w-full rounded-full border border-white/10 bg-white/5">
                <div
                  className={`h-full rounded-full ${
                    p.burn_rate >= 90 ? 'bg-[var(--coral)]' : 'bg-[var(--lime)]'
                  }`}
                  style={{ width: `${Math.min(p.burn_rate, 100)}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {p.logged_hours.toFixed(1)} hours logged
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => openDetails(p)} className="btn-accent px-4 py-1.5 text-xs">
                View Details
              </button>
              <button onClick={() => toggleStatus(p)} className="btn-ghost px-4 py-1.5 text-xs">
                Mark {p.status === 'active' ? 'Completed' : 'Active'}
              </button>
              <button onClick={() => remove(p.id)} className="btn-danger px-4 py-1.5 text-xs">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {detail && (
        <ProjectDetailModal
          data={detail}
          owner={user?.name}
          money={money}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function ProjectDetailModal({ data, owner, money, onClose }) {
  const { project, logs, invoices } = data;
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '' });

  const loadTasks = () =>
    api.get('/tasks', { params: { project_id: project.id } }).then((r) => setTasks(r.data));
  useEffect(() => {
    loadTasks();
  }, [project.id]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    await api.post('/tasks', {
      project_id: project.id,
      title: taskForm.title.trim(),
      due_date: taskForm.due_date || null,
    });
    setTaskForm({ title: '', due_date: '' });
    loadTasks();
  };

  const toggleTask = async (t) => {
    await api.put(`/tasks/${t.id}`, { completed: !t.completed, due_date: t.due_date });
    loadTasks();
  };

  const removeTask = async (id) => {
    await api.delete(`/tasks/${id}`);
    loadTasks();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/12 bg-slate-900/80 p-6 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <span className="mb-1 inline-block rounded-lg px-3 py-1 font-display text-2xl font-bold text-slate-900" style={{ backgroundImage: 'linear-gradient(135deg, #3ef2a0, #38bdf8)' }}>
              {project.name}
            </span>
            <div className="mt-1 text-sm text-slate-400">
              Owner: <span className="font-semibold text-white">{owner}</span> · Client:{' '}
              <span className="font-semibold text-white">{project.client_name}</span>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn">
            ✕
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Status', project.status],
            ['Budget', money(project.budget)],
            ['Logged Cost', money(project.logged_cost)],
            ['Burn Rate', `${project.burn_rate}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">{k}</div>
              <div className="mt-0.5 font-display font-semibold text-white">{v}</div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h3 className="mb-2 font-display font-semibold text-white">
            Tasks ({tasks.filter((t) => !t.completed).length} open / {tasks.length})
          </h3>
          <form onSubmit={addTask} className="mb-3 flex flex-wrap gap-2">
            <input
              className="input flex-1 min-w-[10rem]"
              placeholder="New task title *"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
            />
            <input
              className="input w-40"
              type="date"
              value={taskForm.due_date}
              onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
            />
            <button className="btn-primary px-4 py-1.5 text-xs">+ Add Task</button>
          </form>
          <div className="space-y-2">
            {tasks.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-400">
                No tasks yet.
              </div>
            )}
            {tasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={t.completed}
                  onChange={() => toggleTask(t)}
                  className="h-4 w-4 accent-[var(--lime)]"
                />
                <div className="flex-1">
                  <div
                    className={`text-sm ${
                      t.completed ? 'text-slate-500 line-through' : 'text-slate-100'
                    }`}
                  >
                    {t.title}
                  </div>
                  {t.due_date && (
                    <div className="text-xs text-slate-400">
                      Due {new Date(t.due_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeTask(t.id)}
                  className="icon-btn h-7 w-7 text-xs"
                  title="Delete task"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <h3 className="mb-2 font-display font-semibold text-white">Time Logs ({logs.length})</h3>
        <div className="mb-6 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-center">Billed</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-3 py-3 text-center text-slate-400">
                    No time logs.
                  </td>
                </tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-white/5">
                  <td className="px-3 py-2">{l.description || '—'}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {new Date(l.start_time).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">{(l.duration_minutes / 60).toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">
                    {l.billed ? '✓' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 font-display font-semibold text-white">
          Invoices for {project.client_name} ({invoices.length})
        </h3>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-3 py-3 text-center text-slate-400">
                    No invoices for this client yet.
                  </td>
                </tr>
              )}
              {invoices.map((i) => (
                <tr key={i.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-medium">{i.invoice_number}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {new Date(i.issue_date).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">{money(i.total)}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`badge ${
                        i.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : i.status === 'sent'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {i.status}
                    </span>
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
