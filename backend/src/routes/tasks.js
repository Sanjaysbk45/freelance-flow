import { Router } from 'express';
import { query } from '../db.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// List tasks, optionally filtered by project.
router.get('/', async (req, res) => {
  const { project_id } = req.query;
  const params = [req.user.id];
  let sql = `SELECT t.*, p.name AS project_name
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             WHERE t.user_id = $1`;
  if (project_id) {
    params.push(project_id);
    sql += ` AND t.project_id = $${params.length}`;
  }
  sql += ' ORDER BY t.due_date NULLS LAST, t.created_at DESC';
  const { rows } = await query(sql, params);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { project_id, title, due_date } = req.body;
  if (!project_id || !title) {
    return res.status(400).json({ error: 'project_id and title are required' });
  }
  const owns = await query(
    'SELECT 1 FROM projects WHERE id = $1 AND user_id = $2',
    [project_id, req.user.id]
  );
  if (!owns.rowCount) return res.status(400).json({ error: 'Invalid project' });

  const { rows } = await query(
    `INSERT INTO tasks (user_id, project_id, title, due_date)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [req.user.id, project_id, title, due_date || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { title, due_date, completed } = req.body;
  const { rows } = await query(
    `UPDATE tasks
     SET title = COALESCE($1, title),
         due_date = $2,
         completed = COALESCE($3, completed)
     WHERE id = $4 AND user_id = $5
     RETURNING *`,
    [title, due_date, completed, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Task not found' });
  res.status(204).end();
});

export default router;
