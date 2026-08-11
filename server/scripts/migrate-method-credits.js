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
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'expenses' AND column_name = 'credit'
    `;
    if (cols.length) {
      await sql`ALTER TABLE expenses RENAME COLUMN credit TO method`;
      await sql`ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_credit_check`;
      await sql`ALTER TABLE expenses ALTER COLUMN method SET DEFAULT 'cash'`;
      await sql`ALTER TABLE expenses ALTER COLUMN method SET NOT NULL`;
      await sql`UPDATE expenses SET method = 'cash' WHERE method NOT IN ('cash', 'mobile')`;
      await sql`ALTER TABLE expenses ADD CONSTRAINT expenses_method_check CHECK (method IN ('cash', 'mobile'))`;
      console.log('expenses.credit renamed to method (cash/mobile)');
    } else {
      console.log('expenses.method already present, skipping rename');
    }

    await sql`
      CREATE TABLE IF NOT EXISTS credits (
        id BIGSERIAL PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('borrow', 'payment')),
        amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
        description TEXT DEFAULT '',
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_credits_date ON credits (date DESC)`;
    console.log('credits table ready');

    const expCols = await sql`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'expenses' ORDER BY ordinal_position
    `;
    console.log('expenses columns:', expCols.map((r) => r.column_name).join(', '));
    const crCols = await sql`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'credits' ORDER BY ordinal_position
    `;
    console.log('credits columns:', crCols.map((r) => r.column_name).join(', '));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
})();
