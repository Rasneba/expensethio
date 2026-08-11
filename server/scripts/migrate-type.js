require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense'`;
    console.log('type column added');
    const rows = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'expenses' ORDER BY ordinal_position`;
    console.log('columns:', rows.map((r) => r.column_name).join(', '));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
})();
