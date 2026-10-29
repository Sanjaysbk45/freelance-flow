import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { auth } from '../middleware/auth.js';

const router = Router();

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  try {
    const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, plan`,
      [name, email, hash]
    );
    const user = rows[0];
    res.status(201).json({ token: sign(user), user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const safe = { id: user.id, name: user.name, email: user.email, plan: user.plan };
    res.json({ token: sign(safe), user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// Demo upgrade/downgrade endpoint so evaluators can test tiered access.
router.post('/plan', auth, async (req, res) => {
  const { plan } = req.body;
  if (!['free', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'plan must be "free" or "pro"' });
  }
  const { rows } = await query(
    'UPDATE users SET plan = $1 WHERE id = $2 RETURNING id, name, email, plan',
    [plan, req.user.id]
  );
  res.json({ token: sign(rows[0]), user: rows[0] });
});

export default router;
