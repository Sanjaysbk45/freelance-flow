import { Router } from 'express';
import { query } from '../db.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// List projects with client name, logged hours and burn rate.
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT p.*,
            c.name AS client_name,
            COALESCE(SUM(t.duration_minutes), 0) / 60.0 AS logged_hours,
            COALESCE(SUM(t.duration_minutes / 60.0 * t.hourly_rate), 0) AS logged_cost
     FROM projects p
     JOIN clients c ON c.id = p.client_id
     LEFT JOIN time_logs t ON t.project_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id, c.name
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  const withBurn = rows.map((p) => ({
    ...p,
    logged_hours: Number(p.logged_hours),
    logged_cost: Number(p.logged_cost),
    burn_rate:
      Number(p.budget) > 0
        ? Math.min(100, Math.round((Number(p.logged_cost) / Number(p.budget)) * 100))
        : 0,
  }));
  res.json(withBurn);
});

router.get('/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT p.*, c.name AS client_name, c.hourly_rate AS client_rate
     FROM projects p
     JOIN clients c ON c.id = p.client_id
     WHERE p.id = $1 AND p.user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Project not found' });

  const stats = await query(
    `SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 AS logged_hours,
            COALESCE(SUM(duration_minutes / 60.0 * hourly_rate), 0) AS logged_cost
     FROM time_logs WHERE project_id = $1`,
    [req.params.id]
  );
  const budget = Number(rows[0].budget);
  const loggedCost = Number(stats.rows[0].logged_cost);
  res.json({
    ...rows[0],
    logged_hours: Number(stats.rows[0].logged_hours),
    logged_cost: loggedCost,
    burn_rate: budget > 0 ? Math.min(100, Math.round((loggedCost / budget) * 100)) : 0,
  });
});

router.post('/', async (req, res) => {
  const { client_id, name, status, budget } = req.body;
  if (!client_id || !name) {
    return res.status(400).json({ error: 'client_id and name are required' });
  }
  // Verify the client belongs to this user before linking.
  const owns = await query(
    'SELECT 1 FROM clients WHERE id = $1 AND user_id = $2',
    [client_id, req.user.id]
  );
  if (!owns.rowCount) return res.status(400).json({ error: 'Invalid client' });

  const { rows } = await query(
    `INSERT INTO projects (user_id, client_id, name, status, budget)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [req.user.id, client_id, name, status || 'active', budget || 0]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, status, budget, client_id } = req.body;
  const { rows } = await query(
    `UPDATE projects
     SET name = COALESCE($1, name),
         status = COALESCE($2, status),
         budget = COALESCE($3, budget),
         client_id = COALESCE($4, client_id)
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [name, status, budget, client_id, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM projects WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Project not found' });
  res.status(204).end();
});

export default router;
