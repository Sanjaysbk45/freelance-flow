-- FreelanceFlow database schema
-- Every business table carries user_id for strict multi-tenant isolation.
-- Tables are dropped first so `npm run migrate` always applies a clean schema.

DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS time_logs CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  plan          VARCHAR(10) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(160) NOT NULL,
  email       VARCHAR(160),
  phone       VARCHAR(40),
  company     VARCHAR(160),
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        VARCHAR(160) NOT NULL,
  status      VARCHAR(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  budget      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  due_date    DATE,
  completed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_logs (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id          INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  description      VARCHAR(255),
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  hourly_rate      NUMERIC(10,2) NOT NULL DEFAULT 0,
  billed           BOOLEAN NOT NULL DEFAULT false,
  invoice_id       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id      INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number VARCHAR(40) NOT NULL,
  issue_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE,
  date_from      DATE,
  date_to        DATE,
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          SERIAL PRIMARY KEY,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  hours       NUMERIC(10,2) NOT NULL DEFAULT 0,
  rate        NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_timelogs_user ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
