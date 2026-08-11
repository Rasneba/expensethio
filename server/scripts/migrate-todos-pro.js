const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found. Run `vercel env pull` first or set it in a .env file.');
  process.exit(1);
}

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

const ALTERS = [
  "ALTER TABLE todos ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''",
  "ALTER TABLE todos ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo'",
  "ALTER TABLE todos ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'",
  'ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ',
  'ALTER TABLE todos ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER',
  "ALTER TABLE todos ADD COLUMN IF NOT EXISTS repeat TEXT NOT NULL DEFAULT 'none'",
  'ALTER TABLE todos ADD COLUMN IF NOT EXISTS repeat_every INTEGER',
  'ALTER TABLE todos ADD COLUMN IF NOT EXISTS repeat_unit TEXT',
  "ALTER TABLE todos ADD COLUMN IF NOT EXISTS category TEXT DEFAULT ''",
  "ALTER TABLE todos ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''",
];

(async () => {
  try {
    for (const stmt of ALTERS) {
      await sql.query(stmt);
    }

    await sql.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_status_check' AND conrelid = 'todos'::regclass) THEN ALTER TABLE todos ADD CONSTRAINT todos_status_check CHECK (status IN ('todo', 'in_progress', 'done')); END IF; END $$;"
    );
    await sql.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_priority_check' AND conrelid = 'todos'::regclass) THEN ALTER TABLE todos ADD CONSTRAINT todos_priority_check CHECK (priority IN ('high', 'medium', 'low')); END IF; END $$;"
    );
    await sql.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_repeat_check' AND conrelid = 'todos'::regclass) THEN ALTER TABLE todos ADD CONSTRAINT todos_repeat_check CHECK (repeat IN ('none', 'daily', 'weekday', 'weekly', 'monthly', 'custom')); END IF; END $$;"
    );

    await sql.query('CREATE INDEX IF NOT EXISTS idx_todos_due_at ON todos (due_at)');
    await sql.query('CREATE INDEX IF NOT EXISTS idx_todos_status ON todos (status)');

    await sql.query("UPDATE todos SET status = 'done' WHERE done = true AND status = 'todo'");
    await sql.query("UPDATE todos SET repeat = 'daily', due_at = COALESCE(due_at, CURRENT_TIMESTAMP) WHERE period = 'daily' AND repeat = 'none'");
    await sql.query("UPDATE todos SET repeat = 'weekly', due_at = COALESCE(due_at, CURRENT_TIMESTAMP) WHERE period = 'weekly' AND repeat = 'none'");
    await sql.query("UPDATE todos SET repeat = 'monthly', due_at = COALESCE(due_at, CURRENT_TIMESTAMP) WHERE period = 'monthly' AND repeat = 'none'");

    console.log('todos table migrated (pro fields added)');

    const cols = await sql.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'todos' ORDER BY ordinal_position"
    );
    console.log('todos columns:', cols.map((r) => r.column_name).join(', '));

    const counts = await sql.query("SELECT status, count(*)::int AS n FROM todos GROUP BY status ORDER BY status");
    console.log('by status:', counts.map((r) => `${r.status}=${r.n}`).join(', '));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
})();
