import { Router } from 'express';
import { query } from '../db.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// Resolve the billing rate for a project (falls back to the client rate).
async function rateForProject(projectId, userId) {
  const { rows } = await query(
    `SELECT c.hourly_rate
     FROM projects p
     JOIN clients c ON c.id = p.client_id
     WHERE p.id = $1 AND p.user_id = $2`,
    [projectId, userId]
  );
  return rows[0] ? Number(rows[0].hourly_rate) : 0;
}

// List time logs, optionally filtered by project.
router.get('/', async (req, res) => {
  const { project_id } = req.query;
  const params = [req.user.id];
  let sql = `SELECT tl.*, p.name AS project_name
             FROM time_logs tl
             JOIN projects p ON p.id = tl.project_id
             WHERE tl.user_id = $1`;
  if (project_id) {
    params.push(project_id);
    sql += ` AND tl.project_id = $${params.length}`;
  }
  sql += ' ORDER BY tl.start_time DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
});

// Start a stopwatch: creates an open log with no end_time.
router.post('/start', async (req, res) => {
  const { project_id, task_id, description } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });

  // Guard against two running timers for the same user.
  const open = await query(
    'SELECT 1 FROM time_logs WHERE user_id = $1 AND end_time IS NULL',
    [req.user.id]
  );
  if (open.rowCount) {
    return res.status(409).json({ error: 'A timer is already running' });
  }

  const rate = await rateForProject(project_id, req.user.id);
  const { rows } = await query(
    `INSERT INTO time_logs (user_id, project_id, task_id, description, start_time, hourly_rate)
     VALUES ($1, $2, $3, $4, now(), $5)
     RETURNING *`,
    [req.user.id, project_id, task_id || null, description || null, rate]
  );
  res.status(201).json(rows[0]);
});

// Return the currently running timer, if any.
router.get('/running', async (req, res) => {
  const { rows } = await query(
    `SELECT tl.*, p.name AS project_name
     FROM time_logs tl
     JOIN projects p ON p.id = tl.project_id
     WHERE tl.user_id = $1 AND tl.end_time IS NULL
     LIMIT 1`,
    [req.user.id]
  );
  res.json(rows[0] || null);
});

// Stop the running timer and compute duration.
router.post('/stop', async (req, res) => {
  const { rows } = await query(
    `UPDATE time_logs
     SET end_time = now(),
         duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (now() - start_time)) / 60))
     WHERE user_id = $1 AND end_time IS NULL
     RETURNING *`,
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'No running timer' });
  res.json(rows[0]);
});

// Manual entry: log hours worked without the stopwatch.
router.post('/manual', async (req, res) => {
  const { project_id, task_id, description, hours, date } = req.body;
  if (!project_id || !hours) {
    return res.status(400).json({ error: 'project_id and hours are required' });
  }
  if (Number(hours) <= 0) {
    return res.status(400).json({ error: 'hours must be greater than 0' });
  }
  const minutes = Math.round(Number(hours) * 60);
  const start = date ? new Date(date) : new Date();
  const end = new Date(start.getTime() + minutes * 60000);
  const rate = await rateForProject(project_id, req.user.id);

  const { rows } = await query(
    `INSERT INTO time_logs
       (user_id, project_id, task_id, description, start_time, end_time, duration_minutes, hourly_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [req.user.id, project_id, task_id || null, description || null, start, end, minutes, rate]
  );
  res.status(201).json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM time_logs WHERE id = $1 AND user_id = $2 AND billed = false',
    [req.params.id, req.user.id]
  );
  if (!rowCount) {
    return res.status(404).json({ error: 'Log not found or already billed' });
  }
  res.status(204).end();
});

export default router;
