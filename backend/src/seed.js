import pool from './db.js';

// Populate a user's account with realistic sample data so evaluators can
// immediately see populated charts, projects and invoices.
export async function seedUser(userId) {
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');

    // Clear any existing data for a clean, repeatable seed.
    await conn.query('DELETE FROM clients WHERE user_id = $1', [userId]);

    const clientsData = [
      ['Acme Corp', 'billing@acme.io', '555-0101', 'Acme Corporation', 85],
      ['Nimbus Design', 'hello@nimbus.co', '555-0144', 'Nimbus Studio', 70],
    ];
    const clients = [];
    for (const c of clientsData) {
      const { rows } = await conn.query(
        `INSERT INTO clients (user_id, name, email, phone, company, hourly_rate)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [userId, ...c]
      );
      clients.push(rows[0]);
    }

    const projectsData = [
      [clients[0].id, 'Website Redesign', 'active', 8000],
      [clients[0].id, 'Mobile App MVP', 'active', 15000],
      [clients[1].id, 'Brand Identity', 'completed', 4000],
    ];
    const projects = [];
    for (const p of projectsData) {
      const { rows } = await conn.query(
        `INSERT INTO projects (user_id, client_id, name, status, budget)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [userId, ...p]
      );
      projects.push(rows[0]);
    }

    // Tasks with upcoming deadlines.
    const taskData = [
      [projects[0].id, 'Design homepage mockup', 5, true],
      [projects[0].id, 'Build responsive navbar', 3, false],
      [projects[1].id, 'Set up authentication', 7, false],
      [projects[1].id, 'Design onboarding flow', 12, false],
    ];
    for (const [pid, title, dayOffset, done] of taskData) {
      await conn.query(
        `INSERT INTO tasks (user_id, project_id, title, due_date, completed)
         VALUES ($1,$2,$3, CURRENT_DATE + $4::int, $5)`,
        [userId, pid, title, dayOffset, done]
      );
    }

    // Time logs spread across the last few months (some billed via invoices below).
    const logData = [
      [projects[0].id, 'Wireframing', 6, 40],
      [projects[0].id, 'Homepage build', 8, 25],
      [projects[1].id, 'API scaffolding', 10, 15],
      [projects[1].id, 'Auth flow', 5, 8],
      [projects[2].id, 'Logo concepts', 12, 60],
    ];
    for (const [pid, desc, hours, daysAgo] of logData) {
      const proj = projects.find((p) => p.id === pid);
      const client = clients.find((c) => c.id === proj.client_id);
      const minutes = hours * 60;
      await conn.query(
        `INSERT INTO time_logs
           (user_id, project_id, description, start_time, end_time, duration_minutes, hourly_rate)
         VALUES ($1,$2,$3, now() - ($4 || ' days')::interval,
                 now() - ($4 || ' days')::interval + ($5 || ' minutes')::interval, $5::int, $6)`,
        [userId, pid, desc, String(daysAgo), String(minutes), client.hourly_rate]
      );
    }

    // A couple of historical invoices to populate the revenue chart.
    const invData = [
      [clients[0].id, 'paid', 3400, 90],
      [clients[0].id, 'paid', 2550, 60],
      [clients[1].id, 'sent', 1800, 20],
    ];
    for (const [cid, status, total, daysAgo] of invData) {
      const number = 'INV-' + Math.floor(Math.random() * 1e8).toString().padStart(8, '0');
      const inv = await conn.query(
        `INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, subtotal, total, status)
         VALUES ($1,$2,$3, CURRENT_DATE - $4::int, $5, $5, $6) RETURNING id`,
        [userId, cid, number, daysAgo, total, status]
      );
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, description, hours, rate, amount)
         VALUES ($1, 'Consulting services', $2, 85, $3)`,
        [inv.rows[0].id, (total / 85).toFixed(2), total]
      );
    }

    await conn.query('COMMIT');
    return { clients: clients.length, projects: projects.length };
  } catch (err) {
    await conn.query('ROLLBACK');
    throw err;
  } finally {
    conn.release();
  }
}

// CLI: `npm run seed` creates a demo account and fills it with sample data.
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const bcrypt = (await import('bcryptjs')).default;
  (async () => {
    const email = 'demo@freelanceflow.app';
    const hash = await bcrypt.hash('demo1234', 10);
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    if (existing.rowCount) {
      userId = existing.rows[0].id;
      await pool.query("UPDATE users SET plan = 'pro' WHERE id = $1", [userId]);
    } else {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash, plan)
         VALUES ('Demo User', $1, $2, 'pro') RETURNING id`,
        [email, hash]
      );
      userId = rows[0].id;
    }
    await seedUser(userId);
    console.log('✓ Seeded demo account');
    console.log('  Email:    demo@freelanceflow.app');
    console.log('  Password: demo1234  (Pro plan)');
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
