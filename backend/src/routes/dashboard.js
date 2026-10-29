import { Router } from 'express';
import { query } from '../db.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// Aggregate dashboard metrics for the signed-in user.
router.get('/summary', async (req, res) => {
  const uid = req.user.id;

  const [clients, activeProjects, pendingInvoices, outstanding, deadlines, hours] =
    await Promise.all([
      query('SELECT COUNT(*)::int AS n FROM clients WHERE user_id = $1', [uid]),
      query("SELECT COUNT(*)::int AS n FROM projects WHERE user_id = $1 AND status = 'active'", [uid]),
      query("SELECT COUNT(*)::int AS n FROM invoices WHERE user_id = $1 AND status != 'paid'", [uid]),
      query("SELECT COALESCE(SUM(total),0) AS s FROM invoices WHERE user_id = $1 AND status != 'paid'", [uid]),
      query(
        `SELECT t.id, t.title, t.due_date, p.name AS project_name
         FROM tasks t JOIN projects p ON p.id = t.project_id
         WHERE t.user_id = $1 AND t.completed = false AND t.due_date IS NOT NULL
           AND t.due_date >= CURRENT_DATE
         ORDER BY t.due_date ASC LIMIT 5`,
        [uid]
      ),
      query(
        `SELECT COALESCE(SUM(duration_minutes),0) / 60.0 AS h
         FROM time_logs WHERE user_id = $1`,
        [uid]
      ),
    ]);

  res.json({
    clients: clients.rows[0].n,
    active_projects: activeProjects.rows[0].n,
    pending_invoices: pendingInvoices.rows[0].n,
    outstanding: Number(outstanding.rows[0].s),
    total_hours: Number(hours.rows[0].h).toFixed(1),
    upcoming_deadlines: deadlines.rows,
  });
});

// Monthly revenue (paid invoices) for the chart — last 6 months.
router.get('/revenue', async (req, res) => {
  const { rows } = await query(
    `SELECT to_char(date_trunc('month', issue_date), 'Mon YYYY') AS month,
            date_trunc('month', issue_date) AS sort,
            SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) AS revenue,
            SUM(CASE WHEN status != 'paid' THEN total ELSE 0 END) AS outstanding
     FROM invoices
     WHERE user_id = $1 AND issue_date >= (CURRENT_DATE - INTERVAL '6 months')
     GROUP BY 1, 2
     ORDER BY sort`,
    [req.user.id]
  );
  res.json(
    rows.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      outstanding: Number(r.outstanding),
    }))
  );
});

export default router;
