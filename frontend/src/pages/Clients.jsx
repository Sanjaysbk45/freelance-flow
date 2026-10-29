import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const empty = { name: '', email: '', phone: '', company: '', hourly_rate: '' };

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/clients').then((r) => setClients(r.data));
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...form, hourly_rate: Number(form.hourly_rate) || 0 };
      if (editing) await api.put(`/clients/${editing}`, payload);
      else await api.post('/clients', payload);
      setForm(empty);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  const edit = (c) => {
    setEditing(c.id);
    setForm({
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      company: c.company || '',
      hourly_rate: c.hourly_rate,
    });
  };

  const remove = async (id) => {
    if (!confirm('Delete this client and all its projects?')) return;
    await api.delete(`/clients/${id}`);
    load();
  };

  const atLimit = user?.plan === 'free' && clients.length >= 2 && !editing;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Clients</h1>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={save} className="card space-y-3 lg:col-span-1">
          <h2 className="font-semibold">{editing ? 'Edit Client' : 'New Client'}</h2>
          {atLimit && (
            <div className="rounded bg-amber-50 p-2 text-xs text-amber-700">
              Free plan limit reached (2 clients). Upgrade to Pro for unlimited.
            </div>
          )}
          <input
            className="input"
            placeholder="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input"
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
          <input
            className="input"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="input"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Default hourly rate"
            value={form.hourly_rate}
            onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
          />
          <div className="flex gap-2">
            <button disabled={atLimit} className="btn-primary flex-1">
              {editing ? 'Update' : 'Add Client'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                }}
                className="btn-ghost"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="space-y-3 lg:col-span-2">
          {clients.length === 0 && (
            <div className="card text-sm text-gray-400">No clients yet.</div>
          )}
          {clients.map((c) => (
            <div key={c.id} className="card flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">
                  {c.company || '—'} · {c.project_count} projects · ${c.hourly_rate}/hr
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => edit(c)} className="btn-ghost px-3 py-1.5 text-xs">
                  Edit
                </button>
                <button onClick={() => remove(c.id)} className="btn-danger px-3 py-1.5 text-xs">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
