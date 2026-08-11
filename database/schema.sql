-- Expense Tracker - Database schema
-- Run this in the Neon SQL editor (or psql) to create your tables.

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'mobile')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);

CREATE TABLE IF NOT EXISTS credits (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('borrow', 'payment')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  creditor TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credits_date ON credits (date DESC);
CREATE INDEX IF NOT EXISTS idx_credits_due_date ON credits (due_date) WHERE due_date IS NOT NULL;

-- Migration: add due_date and creditor columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credits' AND column_name = 'due_date') THEN
    ALTER TABLE credits ADD COLUMN due_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credits' AND column_name = 'creditor') THEN
    ALTER TABLE credits ADD COLUMN creditor TEXT DEFAULT '';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS todos (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'general' CHECK (period IN ('daily', 'weekly', 'monthly', 'general')),
  done BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due_at TIMESTAMPTZ,
  reminder_minutes INTEGER,
  repeat TEXT NOT NULL DEFAULT 'none' CHECK (repeat IN ('none', 'daily', 'weekday', 'weekly', 'monthly', 'custom')),
  repeat_every INTEGER,
  repeat_unit TEXT,
  category TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_period ON todos (period);
CREATE INDEX IF NOT EXISTS idx_todos_due_at ON todos (due_at);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos (status);

CREATE TABLE IF NOT EXISTS budgets (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  month DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, month)
);

CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets (month DESC);
