import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import api from '../api';

const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 });

function Stat({ label, value, accent, to }) {
  return (
    <Link to={to} className="card group block transition-all hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{label}</div>
        <span className="text-xs font-bold text-slate-300 transition group-hover:text-black">
          →
        </span>
      </div>
      <div className={`mt-1 text-2xl font-bold ${accent || 'text-gray-900'}`}>{value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-400">View details</div>
    </Link>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [seeding, setSeeding] = useState(false);

  const load = () => {
    api.get('/dashboard/summary').then((r) => setSummary(r.data));
    api.get('/dashboard/revenue').then((r) => setRevenue(r.data));
  };

  useEffect(load, []);

  const loadSample = async () => {
    setSeeding(true);
    try {
      await api.post('/seed');
      load();
    } finally {
      setSeeding(false);
    }
  };

  if (!summary) return <div className="text-gray-400">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <button onClick={loadSample} disabled={seeding} className="btn-ghost">
          {seeding ? 'Loading…' : 'Load Sample Data'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active Projects" value={summary.active_projects} accent="text-brand" to="/insights/active-projects" />
        <Stat label="Pending Invoices" value={summary.pending_invoices} to="/insights/pending-invoices" />
        <Stat label="Outstanding" value={money(summary.outstanding)} accent="text-amber-600" to="/insights/outstanding" />
        <Stat label="Hours Tracked" value={summary.total_hours} to="/insights/hours" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-4 font-semibold">Revenue vs Outstanding</h2>
          {revenue.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              No invoice data yet. Click “Load Sample Data”.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => money(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue (paid)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 font-semibold">Upcoming Deadlines</h2>
          {summary.upcoming_deadlines.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing due soon.</p>
          ) : (
            <ul className="space-y-3">
              {summary.upcoming_deadlines.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-gray-500">{t.project_name}</div>
                  </div>
                  <span className="badge bg-gray-100 text-gray-600">
                    {new Date(t.due_date).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
