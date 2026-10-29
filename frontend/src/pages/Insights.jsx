import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

// Each metric pulls from its own logical source endpoint.
const METRICS = {
  'active-projects': {
    title: 'Active Projects',
    subtitle: 'Every project currently in progress.',
    source: '/projects',
    kind: 'projects',
    accent: 'var(--lime)',
    filter: (rows) => rows.filter((p) => p.status === 'active'),
  },
  'pending-invoices': {
    title: 'Pending Invoices',
    subtitle: 'Invoices that have not been paid yet.',
    source: '/invoices',
    kind: 'invoices',
    accent: 'var(--sky)',
    filter: (rows) => rows.filter((i) => i.status !== 'paid'),
  },
  outstanding: {
    title: 'Outstanding Balance',
    subtitle: 'Money still owed across all unpaid invoices.',
    source: '/invoices',
    kind: 'invoices',
    accent: 'var(--coral)',
    filter: (rows) => rows.filter((i) => i.status !== 'paid'),
  },
  hours: {
    title: 'Hours Tracked',
    subtitle: 'All completed time entries across your projects.',
    source: '/timelogs',
    kind: 'hours',
    accent: 'var(--violet)',
    filter: (rows) => rows.filter((l) => l.end_time),
  },
};

const statusTone = {
  paid: 'bg-[var(--lime)] text-black',
  sent: 'bg-[var(--sky)] text-black',
  draft: 'bg-white text-black',
};

export default function Insights() {
  const { metric } = useParams();
  const config = METRICS[metric];
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!config) return;
    setRows(null);
    api.get(config.source).then((r) => setRows(config.filter(r.data)));
  }, [metric]);

  const totals = useMemo(() => {
    if (!rows) return null;
    if (config.kind === 'invoices') {
      return {
        count: rows.length,
        amount: rows.reduce((s, i) => s + Number(i.total || 0), 0),
      };
    }
    if (config.kind === 'hours') {
      const mins = rows.reduce((s, l) => s + Number(l.duration_minutes || 0), 0);
      return { count: rows.length, hours: mins / 60 };
    }
    return {
      count: rows.length,
      budget: rows.reduce((s, p) => s + Number(p.budget || 0), 0),
      logged: rows.reduce((s, p) => s + Number(p.logged_cost || 0), 0),
    };
  }, [rows, config]);

  if (!config) {
    return (
      <div className="card">
        <p className="text-sm font-medium">Unknown insight.</p>
        <Link to="/" className="btn-ghost mt-3">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="btn-ghost">
          ← Dashboard
        </Link>
        <h1 className="font-display text-2xl font-bold">{config.title}</h1>
      </div>

      {/* Headline summary tiles derived from the fetched source. */}
      {totals && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryTile accent={config.accent} label="Count" value={totals.count} />
          {config.kind === 'invoices' && (
            <SummaryTile accent="var(--coral)" label="Total Value" value={money(totals.amount)} />
          )}
          {config.kind === 'hours' && (
            <SummaryTile accent="var(--sky)" label="Total Hours" value={totals.hours.toFixed(1)} />
          )}
          {config.kind === 'projects' && (
            <>
              <SummaryTile accent="var(--sky)" label="Budget" value={money(totals.budget)} />
              <SummaryTile accent="var(--coral)" label="Logged Cost" value={money(totals.logged)} />
            </>
          )}
        </div>
      )}

      <p className="text-sm text-slate-600">{config.subtitle}</p>

      {!rows ? (
        <div className="card text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card text-sm text-slate-400">Nothing to show here yet.</div>
      ) : config.kind === 'projects' ? (
        <ProjectsList rows={rows} />
      ) : config.kind === 'invoices' ? (
        <InvoicesTable rows={rows} />
      ) : (
        <HoursTable rows={rows} />
      )}
    </div>
  );
}

function SummaryTile({ label, value, accent }) {
  return (
    <div className="card" style={{ background: accent }}>
      <div className="text-xs font-bold uppercase tracking-wide text-black/70">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold text-black">{value}</div>
    </div>
  );
}

function ProjectsList({ rows }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((p) => (
        <div key={p.id} className="card space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-display font-bold">{p.name}</div>
              <div className="text-xs text-slate-500">{p.client_name}</div>
            </div>
            <span className="badge bg-[var(--lime)] text-black">{p.status}</span>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>
                {money(p.logged_cost)} / {money(p.budget)}
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
              {Number(p.logged_hours).toFixed(1)} hours logged
            </div>
          </div>
          <Link to="/projects" className="btn-accent px-4 py-1.5 text-xs">
            Open in Projects
          </Link>
        </div>
      ))}
    </div>
  );
}

function InvoicesTable({ rows }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase text-slate-400">
            <th className="pb-2">Number</th>
            <th className="pb-2">Client</th>
            <th className="pb-2">Issued</th>
            <th className="pb-2">Due</th>
            <th className="pb-2 text-right">Total</th>
            <th className="pb-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} className="border-b border-white/5">
              <td className="py-2 font-semibold">{i.invoice_number}</td>
              <td className="py-2">{i.client_name}</td>
              <td className="py-2 text-slate-400">{fmtDate(i.issue_date)}</td>
              <td className="py-2 text-slate-400">{fmtDate(i.due_date)}</td>
              <td className="py-2 text-right font-semibold">{money(i.total)}</td>
              <td className="py-2 text-center">
                <span className={`badge ${statusTone[i.status] || 'bg-white text-black'}`}>
                  {i.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4">
        <Link to="/invoices" className="btn-accent px-4 py-1.5 text-xs">
          Go to Invoices
        </Link>
      </div>
    </div>
  );
}

function HoursTable({ rows }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase text-slate-400">
            <th className="pb-2">Project</th>
            <th className="pb-2">Description</th>
            <th className="pb-2">Date</th>
            <th className="pb-2 text-right">Hours</th>
            <th className="pb-2 text-center">Billed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-b border-white/5">
              <td className="py-2 font-semibold">{l.project_name}</td>
              <td className="py-2">{l.description || '—'}</td>
              <td className="py-2 text-slate-500">{fmtDate(l.start_time)}</td>
              <td className="py-2 text-right">{(l.duration_minutes / 60).toFixed(2)}</td>
              <td className="py-2 text-center">{l.billed ? '✓' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4">
        <Link to="/time" className="btn-accent px-4 py-1.5 text-xs">
          Go to Time Tracking
        </Link>
      </div>
    </div>
  );
}
