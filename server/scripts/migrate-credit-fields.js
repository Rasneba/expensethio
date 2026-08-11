const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found. Run `vercel env pull` first or set it in a .env file.');
  process.exit(1);
}

const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    const due = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'credits' AND column_name = 'due_date'
    `;
    if (due.length) {
      console.log('credits.due_date already present, skipping');
    } else {
      await sql`ALTER TABLE credits ADD COLUMN due_date DATE`;
      console.log('added credits.due_date');
    }

    const creditor = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'credits' AND column_name = 'creditor'
    `;
    if (creditor.length) {
      console.log('credits.creditor already present, skipping');
    } else {
      await sql`ALTER TABLE credits ADD COLUMN creditor TEXT DEFAULT ''`;
      console.log('added credits.creditor');
    }

    await sql`
      CREATE INDEX IF NOT EXISTS idx_credits_due_date ON credits (due_date) WHERE due_date IS NOT NULL
    `;
    console.log('index idx_credits_due_date ready');

    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'credits' ORDER BY ordinal_position
    `;
    console.log('credits columns:', cols.map((r) => r.column_name).join(', '));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
})();
