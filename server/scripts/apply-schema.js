require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);
const schema = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');

const statements = schema
  .split(';')
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter((s) => s.length > 0);

(async () => {
  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt + ';');
      console.log('OK:', stmt.split('\n')[0].slice(0, 60));
    } catch (err) {
      console.error('FAILED:', stmt.slice(0, 60), '-', err.message);
      process.exitCode = 1;
    }
  }
  const rows = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses'`;
  console.log('expenses table exists:', rows.length === 1);
})();
