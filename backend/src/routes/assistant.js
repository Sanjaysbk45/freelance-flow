import { Router } from 'express';
import { query } from '../db.js';
import { auth } from '../middleware/auth.js';
import { searchKnowledge } from '../data/knowledge.js';

const router = Router();
router.use(auth);

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const hrs = (minutes) => (Number(minutes || 0) / 60).toFixed(1);

// Try to find a project the user named inside their message.
async function matchProject(userId, text) {
  const { rows } = await query(
    'SELECT id, name, status, budget FROM projects WHERE user_id = $1',
    [userId]
  );
  return rows.find((p) => text.includes(p.name.toLowerCase())) || null;
}

// A lightweight, data-grounded assistant. It maps the user's question to an
// intent, runs a scoped query (always filtered by req.user.id), and answers
// in plain language. No external AI service is used.
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const raw = String(req.body?.message || '').trim();
  const text = raw.toLowerCase();

  if (!raw) {
    return res.json({ reply: 'Ask me about your projects, hours, invoices, clients or deadlines.' });
  }

  const has = (...words) => words.some((w) => text.includes(w));

  try {
    // Greetings
    if (/^(hi|hey|hello|yo|hiya|good (morning|afternoon|evening))\b/.test(text)) {
      return res.json({
        reply:
          "Hi! I'm your FreelanceFlow assistant. I can answer questions about your clients, " +
          'projects, logged hours, invoices and deadlines. Try "how much is outstanding?" or ' +
          '"which deadlines are coming up?"',
      });
    }

    // Help / capabilities
    if (has('help', 'what can you', 'commands', 'how do you work')) {
      return res.json({
        reply:
          'I can tell you about:\n' +
          '• Outstanding & paid amounts — "how much is outstanding?"\n' +
          '• Logged hours — "how many hours total?" or "hours on <project>"\n' +
          '• Active / completed projects — "list my active projects"\n' +
          '• Invoices — "show unpaid invoices"\n' +
          '• Clients — "how many clients do I have?"\n' +
          '• Deadlines — "what\'s due soon?"\n' +
          '• Budget burn — "burn rate on <project>"',
      });
    }

    // How-to / conceptual questions go to the knowledge base first, so they
    // aren't captured by the data intents below (e.g. "how do I create an
    // invoice?" should explain, not list invoices).
    const howTo =
      /\bhow (do|to|can|could|would|should|does)\b/.test(text) ||
      /\b(what is|what's a|what are|whats a|explain|guide|tutorial|steps|where do)\b/.test(text);
    if (howTo) {
      const kb = searchKnowledge(text);
      if (kb) return res.json({ reply: kb, source: 'knowledge-base' });
    }

    // Outstanding / unpaid total
    if (has('outstanding', 'owed', 'unpaid total', 'how much is owed') ||
        (has('unpaid', 'pending') && has('total', 'amount', 'how much'))) {
      const { rows } = await query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(total), 0) AS amount
         FROM invoices WHERE user_id = $1 AND status <> 'paid'`,
        [userId]
      );
      const { n, amount } = rows[0];
      return res.json({
        reply:
          n === 0
            ? 'You have no outstanding invoices — everything is paid. 🎉'
            : `You have ${n} unpaid invoice${n === 1 ? '' : 's'} totalling ${money(amount)} outstanding.`,
      });
    }

    // Revenue / paid / earned
    if (has('revenue', 'earned', 'income', 'paid total', 'how much have i made', 'how much did i make') ||
        (has('paid') && has('total', 'how much', 'amount'))) {
      const { rows } = await query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(total), 0) AS amount
         FROM invoices WHERE user_id = $1 AND status = 'paid'`,
        [userId]
      );
      const { n, amount } = rows[0];
      return res.json({
        reply: `You've been paid ${money(amount)} across ${n} paid invoice${n === 1 ? '' : 's'}.`,
      });
    }

    // Hours — total or per project
    if (has('hour', 'hours', 'time logged', 'logged time', 'how long')) {
      const project = await matchProject(userId, text);
      if (project) {
        const { rows } = await query(
          `SELECT COALESCE(SUM(duration_minutes), 0) AS m
           FROM time_logs WHERE user_id = $1 AND project_id = $2 AND end_time IS NOT NULL`,
          [userId, project.id]
        );
        return res.json({
          reply: `You've logged ${hrs(rows[0].m)} hours on "${project.name}".`,
        });
      }
      const { rows } = await query(
        `SELECT COALESCE(SUM(duration_minutes), 0) AS m
         FROM time_logs WHERE user_id = $1 AND end_time IS NOT NULL`,
        [userId]
      );
      return res.json({ reply: `You've logged ${hrs(rows[0].m)} hours in total across all projects.` });
    }

    // Burn rate / budget
    if (has('burn', 'budget')) {
      const project = await matchProject(userId, text);
      const sql = `
        SELECT p.name, p.budget,
               COALESCE(SUM(t.duration_minutes / 60.0 * t.hourly_rate), 0) AS spent
        FROM projects p
        LEFT JOIN time_logs t ON t.project_id = p.id AND t.end_time IS NOT NULL
        WHERE p.user_id = $1 ${project ? 'AND p.id = $2' : ''}
        GROUP BY p.id, p.name, p.budget
        ORDER BY p.name`;
      const { rows } = await query(sql, project ? [userId, project.id] : [userId]);
      if (!rows.length) return res.json({ reply: 'You have no projects yet.' });
      const lines = rows.map((r) => {
        const pct = r.budget > 0 ? Math.round((r.spent / r.budget) * 100) : 0;
        return `• ${r.name}: ${money(r.spent)} of ${money(r.budget)} (${pct}% burned)`;
      });
      return res.json({ reply: `Budget burn:\n${lines.join('\n')}` });
    }

    // Projects — active / completed / all
    if (has('project')) {
      const status = has('completed', 'done', 'finished')
        ? 'completed'
        : has('active', 'ongoing', 'current')
        ? 'active'
        : null;
      const { rows } = await query(
        `SELECT p.name, p.status, c.name AS client
         FROM projects p JOIN clients c ON c.id = p.client_id
         WHERE p.user_id = $1 ${status ? 'AND p.status = $2' : ''}
         ORDER BY p.created_at DESC`,
        status ? [userId, status] : [userId]
      );
      if (!rows.length) {
        return res.json({ reply: `You have no ${status || ''} projects yet.`.replace('  ', ' ') });
      }
      const label = status ? `${status} project` : 'project';
      const lines = rows.map((r) => `• ${r.name} — ${r.client} (${r.status})`);
      return res.json({
        reply: `You have ${rows.length} ${label}${rows.length === 1 ? '' : 's'}:\n${lines.join('\n')}`,
      });
    }

    // Invoices — unpaid list or all
    if (has('invoice')) {
      const onlyUnpaid = has('unpaid', 'pending', 'outstanding', 'owed');
      const { rows } = await query(
        `SELECT i.invoice_number, i.total, i.status, c.name AS client
         FROM invoices i JOIN clients c ON c.id = i.client_id
         WHERE i.user_id = $1 ${onlyUnpaid ? "AND i.status <> 'paid'" : ''}
         ORDER BY i.issue_date DESC`,
        [userId]
      );
      if (!rows.length) {
        return res.json({ reply: onlyUnpaid ? 'No unpaid invoices — nicely done!' : 'You have no invoices yet.' });
      }
      const lines = rows.map((r) => `• ${r.invoice_number} — ${r.client} — ${money(r.total)} (${r.status})`);
      return res.json({
        reply: `${onlyUnpaid ? 'Unpaid invoices' : 'Invoices'} (${rows.length}):\n${lines.join('\n')}`,
      });
    }

    // Clients + plan limit
    if (has('client', 'customer')) {
      const { rows } = await query(
        'SELECT name, company FROM clients WHERE user_id = $1 ORDER BY name',
        [userId]
      );
      const plan = req.user.plan || 'free';
      const limitNote =
        plan === 'free'
          ? ` You're on the Free plan (max 2 clients${rows.length >= 2 ? ' — limit reached' : ''}).`
          : ' You\'re on the Pro plan (unlimited clients).';
      if (!rows.length) return res.json({ reply: `You have no clients yet.${limitNote}` });
      const lines = rows.map((r) => `• ${r.name}${r.company ? ` (${r.company})` : ''}`);
      return res.json({
        reply: `You have ${rows.length} client${rows.length === 1 ? '' : 's'}:\n${lines.join('\n')}\n${limitNote}`,
      });
    }

    // Deadlines / due tasks
    if (has('deadline', 'due', 'task', 'upcoming', 'to do', 'todo')) {
      const { rows } = await query(
        `SELECT t.title, t.due_date, p.name AS project
         FROM tasks t JOIN projects p ON p.id = t.project_id
         WHERE t.user_id = $1 AND t.completed = false AND t.due_date IS NOT NULL
         ORDER BY t.due_date ASC
         LIMIT 10`,
        [userId]
      );
      if (!rows.length) return res.json({ reply: 'No upcoming deadlines — you\'re all caught up!' });
      const lines = rows.map((r) => {
        const d = new Date(r.due_date).toLocaleDateString();
        return `• ${r.title} (${r.project}) — due ${d}`;
      });
      return res.json({ reply: `Upcoming deadlines:\n${lines.join('\n')}` });
    }

    // Plan / upgrade
    if (has('plan', 'upgrade', 'pro', 'free', 'subscription')) {
      const plan = req.user.plan || 'free';
      return res.json({
        reply:
          plan === 'pro'
            ? "You're on the Pro plan: unlimited clients and PDF invoicing are unlocked."
            : "You're on the Free plan (max 2 clients, no PDF export). Upgrade to Pro for unlimited clients and downloadable PDF invoices.",
      });
    }

    // Open knowledge base (how-to + freelancing/invoicing concepts).
    const kb = searchKnowledge(text);
    if (kb) return res.json({ reply: kb, source: 'knowledge-base' });

    // Fallback
    return res.json({
      reply:
        "I'm not sure about that one. I can help with hours, outstanding amounts, projects, " +
        'invoices, clients and deadlines — or how-to questions about using FreelanceFlow. ' +
        'Type "help" to see examples.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
