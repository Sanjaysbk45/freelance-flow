import { Router } from 'express';
import { query } from '../db.js';
import { auth } from '../middleware/auth.js';

const router = Router();
const FREE_CLIENT_LIMIT = 2;

router.use(auth);

// List clients (scoped to the authenticated user).
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT c.*,
            COUNT(DISTINCT p.id) AS project_count
     FROM clients c
     LEFT JOIN projects p ON p.client_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { name, email, phone, company, hourly_rate } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  // Freemium limit: Free plan is capped at 2 clients.
  if (req.user.plan === 'free') {
    const { rows } = await query(
      'SELECT COUNT(*)::int AS count FROM clients WHERE user_id = $1',
      [req.user.id]
    );
    if (rows[0].count >= FREE_CLIENT_LIMIT) {
      return res.status(403).json({
        error: `Free plan is limited to ${FREE_CLIENT_LIMIT} clients. Upgrade to Pro for unlimited clients.`,
        upgrade: true,
      });
    }
  }

  const { rows } = await query(
    `INSERT INTO clients (user_id, name, email, phone, company, hourly_rate)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [req.user.id, name, email || null, phone || null, company || null, hourly_rate || 0]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, email, phone, company, hourly_rate } = req.body;
  const { rows } = await query(
    `UPDATE clients
     SET name = COALESCE($1, name),
         email = $2,
         phone = $3,
         company = $4,
         hourly_rate = COALESCE($5, hourly_rate)
     WHERE id = $6 AND user_id = $7
     RETURNING *`,
    [name, email, phone, company, hourly_rate, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM clients WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Client not found' });
  res.status(204).end();
});

export default router;
