import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const { rows } = await query(
      'SELECT id, name, email, plan FROM users WHERE id = $1',
      [payload.id]
    );
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Gate a route behind the Pro plan.
export function requirePro(req, res, next) {
  if (req.user.plan !== 'pro') {
    return res
      .status(403)
      .json({ error: 'Upgrade to Pro to use this feature', upgrade: true });
  }
  next();
}
