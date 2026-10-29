import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

export default function Invoices() {
  const { user, setPlan } = useAuth();
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [wizard, setWizard] = useState({ client_id: '', date_from: '', date_to: '', due_date: '' });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    api.get('/clients').then((r) => setClients(r.data));
    api.get('/invoices').then((r) => setInvoices(r.data));
  };
  useEffect(load, []);

  const doPreview = async () => {
    setError('');
    setPreview(null);
    if (!wizard.client_id) return setError('Select a client');
    const { data } = await api.get('/invoices/preview', {
      params: {
        client_id: wizard.client_id,
        date_from: wizard.date_from || undefined,
        date_to: wizard.date_to || undefined,
      },
    });
    setPreview(data);
  };

  const create = async () => {
    setError('');
    try {
      await api.post('/invoices', wizard);
      setWizard({ client_id: '', date_from: '', date_to: '', due_date: '' });
      setPreview(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create invoice');
    }
  };

  const setStatus = async (id, status) => {
    await api.put(`/invoices/${id}/status`, { status });
    load();
  };

  const downloadPdf = async (inv) => {
    if (user.plan !== 'pro') {
      if (confirm('PDF invoicing is a Pro feature. Upgrade now?')) await setPlan('pro');
      return;
    }
    try {
      const res = await api.get(`/invoices/${inv.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not generate PDF');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Invoices</h1>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {/* Create Invoice Wizard */}
      <div className="card space-y-4">
        <h2 className="font-semibold">Create Invoice</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Client</label>
            <select
              className="input"
              value={wizard.client_id}
              onChange={(e) => setWizard({ ...wizard, client_id: e.target.value })}
            >
              <option value="">Choose client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input
              type="date"
              className="input"
              value={wizard.date_from}
              onChange={(e) => setWizard({ ...wizard, date_from: e.target.value })}
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date"
              className="input"
              value={wizard.date_to}
              onChange={(e) => setWizard({ ...wizard, date_to: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Due date</label>
            <input
              type="date"
              className="input"
              value={wizard.due_date}
              onChange={(e) => setWizard({ ...wizard, due_date: e.target.value })}
            />
          </div>
        </div>
        <button onClick={doPreview} className="btn-ghost">
          Preview Unbilled Time
        </button>

        {preview && (
          <div className="rounded-lg border border-gray-200 p-4">
            {preview.items.length === 0 ? (
              <p className="text-sm text-gray-400">No unbilled time logs for this selection.</p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-gray-500">
                      <th className="pb-2">Project</th>
                      <th className="pb-2 text-right">Hours</th>
                      <th className="pb-2 text-right">Rate</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((it, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2">{it.description}</td>
                        <td className="py-2 text-right">{it.hours}</td>
                        <td className="py-2 text-right">{money(it.rate)}</td>
                        <td className="py-2 text-right">{money(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {preview.log_count} time logs · Total
                  </span>
                  <span className="text-lg font-bold text-brand">{money(preview.total)}</span>
                </div>
                <button onClick={create} className="btn-primary mt-3 w-full">
                  Generate Invoice
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Invoice list */}
      <div className="card">
        <h2 className="mb-4 font-semibold">All Invoices</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-gray-500">
                <th className="pb-2">Number</th>
                <th className="pb-2">Client</th>
                <th className="pb-2">Issued</th>
                <th className="pb-2 text-right">Total</th>
                <th className="pb-2 text-center">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-4 text-center text-gray-400">
                    No invoices yet.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{inv.invoice_number}</td>
                  <td className="py-2">{inv.client_name}</td>
                  <td className="py-2 text-gray-500">
                    {new Date(inv.issue_date).toLocaleDateString()}
                  </td>
                  <td className="py-2 text-right">{money(inv.total)}</td>
                  <td className="py-2 text-center">
                    <select
                      value={inv.status}
                      onChange={(e) => setStatus(inv.id, e.target.value)}
                      className={`badge border-0 ${
                        inv.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : inv.status === 'sent'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <option value="draft">draft</option>
                      <option value="sent">sent</option>
                      <option value="paid">paid</option>
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => downloadPdf(inv)}
                      className="text-xs text-brand hover:underline"
                    >
                      {user.plan === 'pro' ? 'Download PDF' : 'PDF (Pro)'}
                    </button>
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
