-- Expense Tracker - Database schema
-- Run this in the Neon SQL editor (or psql) to create your tables.

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  credit TEXT NOT NULL DEFAULT 'none' CHECK (credit IN ('none', 'purchase', 'payment')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);

CREATE TABLE IF NOT EXISTS todos (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'general' CHECK (period IN ('daily', 'weekly', 'monthly', 'general')),
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_period ON todos (period);
