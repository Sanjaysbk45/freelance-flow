import { Router } from 'express';
import pool, { query } from '../db.js';
import { auth, requirePro } from '../middleware/auth.js';
import { streamInvoicePdf } from '../utils/pdf.js';

const router = Router();
router.use(auth);

// Preview: fetch unbilled time logs for a client within a date range and total them.
router.get('/preview', async (req, res) => {
  const { client_id, date_from, date_to } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id is required' });

  const params = [req.user.id, client_id];
  let sql = `SELECT tl.id, tl.description, tl.duration_minutes, tl.hourly_rate,
                    tl.start_time, p.name AS project_name
             FROM time_logs tl
             JOIN projects p ON p.id = tl.project_id
             WHERE tl.user_id = $1 AND p.client_id = $2
               AND tl.billed = false AND tl.end_time IS NOT NULL`;
  if (date_from) { params.push(date_from); sql += ` AND tl.start_time >= $${params.length}`; }
  if (date_to) { params.push(date_to); sql += ` AND tl.start_time <= $${params.length}`; }
  sql += ' ORDER BY tl.start_time';

  const { rows } = await query(sql, params);

  // Group logs by project into invoice line items.
  const groups = {};
  for (const log of rows) {
    const key = log.project_name;
    if (!groups[key]) groups[key] = { description: key, minutes: 0, rate: Number(log.hourly_rate) };
    groups[key].minutes += log.duration_minutes;
  }
  const items = Object.values(groups).map((g) => {
    const hours = g.minutes / 60;
    return {
      description: g.description,
      hours: Number(hours.toFixed(2)),
      rate: g.rate,
      amount: Number((hours * g.rate).toFixed(2)),
    };
  });
  const subtotal = Number(items.reduce((s, i) => s + i.amount, 0).toFixed(2));

  res.json({ log_count: rows.length, log_ids: rows.map((r) => r.id), items, subtotal, total: subtotal });
});

// Create an invoice from unbilled logs and mark them billed (transactional).
router.post('/', async (req, res) => {
  const { client_id, date_from, date_to, due_date } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id is required' });

  const client = await pool.query(
    'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
    [client_id, req.user.id]
  );
  if (!client.rowCount) return res.status(404).json({ error: 'Client not found' });

  const paramsL = [req.user.id, client_id];
  let logSql = `SELECT tl.id, tl.duration_minutes, tl.hourly_rate, p.name AS project_name
                FROM time_logs tl
                JOIN projects p ON p.id = tl.project_id
                WHERE tl.user_id = $1 AND p.client_id = $2
                  AND tl.billed = false AND tl.end_time IS NOT NULL`;
  if (date_from) { paramsL.push(date_from); logSql += ` AND tl.start_time >= $${paramsL.length}`; }
  if (date_to) { paramsL.push(date_to); logSql += ` AND tl.start_time <= $${paramsL.length}`; }

  const logs = (await query(logSql, paramsL)).rows;
  if (!logs.length) return res.status(400).json({ error: 'No unbilled time logs for this selection' });

  const groups = {};
  for (const log of logs) {
    const key = log.project_name;
    if (!groups[key]) groups[key] = { description: key, minutes: 0, rate: Number(log.hourly_rate) };
    groups[key].minutes += log.duration_minutes;
  }
  const items = Object.values(groups).map((g) => {
    const hours = g.minutes / 60;
    return { description: g.description, hours: +hours.toFixed(2), rate: g.rate, amount: +(hours * g.rate).toFixed(2) };
  });
  const subtotal = +items.reduce((s, i) => s + i.amount, 0).toFixed(2);
  const number = 'INV-' + Date.now().toString().slice(-8);

  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    const inv = await conn.query(
      `INSERT INTO invoices (user_id, client_id, invoice_number, due_date, date_from, date_to, subtotal, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent')
       RETURNING *`,
      [req.user.id, client_id, number, due_date || null, date_from || null, date_to || null, subtotal, subtotal]
    );
    const invoice = inv.rows[0];
    for (const it of items) {
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, description, hours, rate, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [invoice.id, it.description, it.hours, it.rate, it.amount]
      );
    }
    // Mark the logs billed so they can never be invoiced twice.
    await conn.query(
      `UPDATE time_logs SET billed = true, invoice_id = $1 WHERE id = ANY($2::int[])`,
      [invoice.id, logs.map((l) => l.id)]
    );
    await conn.query('COMMIT');
    res.status(201).json({ ...invoice, items });
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT i.*, c.name AS client_name
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.user_id = $1
     ORDER BY i.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const inv = await query(
    `SELECT i.*, c.name AS client_name FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.id = $1 AND i.user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!inv.rows[0]) return res.status(404).json({ error: 'Invoice not found' });
  const items = await query('SELECT * FROM invoice_items WHERE invoice_id = $1', [req.params.id]);
  res.json({ ...inv.rows[0], items: items.rows });
});

router.put('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['draft', 'sent', 'paid'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const { rows } = await query(
    'UPDATE invoices SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
    [status, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Invoice not found' });
  res.json(rows[0]);
});

// PDF download — Pro feature only.
router.get('/:id/pdf', requirePro, async (req, res) => {
  const inv = await query(
    `SELECT i.*, c.name AS cname, c.email AS cemail, c.company AS ccompany
     FROM invoices i JOIN clients c ON c.id = i.client_id
     WHERE i.id = $1 AND i.user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!inv.rows[0]) return res.status(404).json({ error: 'Invoice not found' });
  const items = (await query('SELECT * FROM invoice_items WHERE invoice_id = $1', [req.params.id])).rows;
  const row = inv.rows[0];

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${row.invoice_number}.pdf"`);
  streamInvoicePdf(res, {
    invoice: {
      ...row,
      issue_date: new Date(row.issue_date).toISOString().slice(0, 10),
      due_date: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : null,
    },
    items,
    client: { name: row.cname, email: row.cemail, company: row.ccompany },
    user: req.user,
  });
});

export default router;
