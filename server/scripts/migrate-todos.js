require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS todos (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        period TEXT NOT NULL DEFAULT 'general' CHECK (period IN ('daily', 'weekly', 'monthly', 'general')),
        done BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_todos_period ON todos (period)`;
    console.log('todos table ready');
    const rows = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'todos' ORDER BY ordinal_position`;
    console.log('columns:', rows.map((r) => r.column_name).join(', '));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
})();
