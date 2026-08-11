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
    await sql`
      CREATE TABLE IF NOT EXISTS budgets (
        id BIGSERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
        month DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Ensure the unique constraint exists even if the table pre-existed without it
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'budgets_category_month_key' AND conrelid = 'budgets'::regclass
        ) THEN
          ALTER TABLE budgets ADD CONSTRAINT budgets_category_month_key UNIQUE (category, month);
        END IF;
      END $$;
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets (month DESC)`;
    console.log('budgets table ready');

    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'budgets' ORDER BY ordinal_position
    `;
    console.log('budgets columns:', cols.map((r) => r.column_name).join(', '));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
})();
