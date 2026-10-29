import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbName = process.env.PGDATABASE || 'freelanceflow';
const admin = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
};

async function main() {
  // Connect to the default "postgres" database to create ours if needed.
  const adminClient = new Client({ ...admin, database: 'postgres' });
  await adminClient.connect();
  const exists = await adminClient.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [dbName]
  );
  if (exists.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE ${dbName}`);
    console.log(`✓ Created database "${dbName}"`);
  } else {
    console.log(`• Database "${dbName}" already exists`);
  }
  await adminClient.end();

  // Apply the schema.
  const db = new Client({ ...admin, database: dbName });
  await db.connect();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(sql);
  await db.end();
  console.log('✓ Schema applied successfully.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
