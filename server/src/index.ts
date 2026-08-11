import express from 'express';
import { neon, UnsafeRawSql } from '@neondatabase/serverless';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to your Vercel project environment variables.');
}
const db = neon(process.env.DATABASE_URL!);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});
app.use(limiter);

interface Expense {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
}

const RETURNING = `id, type, amount, category, description, date::text as date, created_at`;
const RETURNING_RAW = () => new UnsafeRawSql(RETURNING);

function parseExpense(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    type: row.type === 'income' ? 'income' : 'expense',
    amount: Number(row.amount),
    category: String(row.category),
    description: String(row.description),
    date: String(row.date),
    created_at: String(row.created_at),
  };
}

function toType(value: unknown): 'expense' | 'income' | null {
  if (value === 'income') return 'income';
  if (value === 'expense') return 'expense';
  return null;
}

function validate(body: Record<string, unknown>, partial: boolean): string | null {
  const { type, amount, category, description, date } = body;

  if (!partial) {
    if (amount === undefined) return 'amount is required';
    if (category === undefined) return 'category is required';
    if (date === undefined) return 'date is required';
  }

  if (type !== undefined && toType(type) === null) {
    return 'type must be "expense" or "income"';
  }
  if (amount !== undefined) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 'amount must be a positive number';
  }
  if (category !== undefined && (typeof category !== 'string' || !category.trim())) {
    return 'category must be a non-empty string';
  }
  if (description !== undefined && typeof description !== 'string') {
    return 'description must be a string';
  }
  if (date !== undefined && (typeof date !== 'string' || isNaN(Date.parse(date)))) {
    return 'date must be a valid date';
  }
  return null;
}

app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await db`
      SELECT id, type, amount, category, description, date::text as date, created_at
      FROM expenses
      ORDER BY date DESC, created_at DESC
    `;
    res.json(expenses.map(parseExpense));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const invalid = validate(req.body, false);
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }

    const { amount, category, description, date, type } = req.body;
    const result = await db`
      INSERT INTO expenses (type, amount, category, description, date)
      VALUES (${toType(type)}, ${Number(amount)}, ${String(category)}, ${description ? String(description) : ''}, ${String(date)})
      RETURNING ${RETURNING_RAW()}
    `;
    res.status(201).json(parseExpense(result[0]));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const invalid = validate(req.body, true);
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }

    const { amount, category, description, date, type } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];
    if (type !== undefined) {
      params.push(toType(type));
      sets.push(`type = $${params.length}`);
    }
    if (amount !== undefined) {
      params.push(Number(amount));
      sets.push(`amount = $${params.length}`);
    }
    if (category !== undefined) {
      params.push(String(category));
      sets.push(`category = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(String(description));
      sets.push(`description = $${params.length}`);
    }
    if (date !== undefined) {
      params.push(String(date));
      sets.push(`date = $${params.length}`);
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    params.push(id);
    const result = await db.query(
      `UPDATE expenses SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${RETURNING}`,
      params
    );
    if (!result[0]) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(parseExpense(result[0]));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db`DELETE FROM expenses WHERE id = ${id}`;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const [
      expenseTotal,
      incomeTotal,
      monthExpense,
      monthIncome,
      countRow,
      byCategory,
      byMonth,
    ] = await Promise.all([
      db`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE type = 'expense'`,
      db`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE type = 'income'`,
      db`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE type = 'expense' AND date >= DATE_TRUNC('month', CURRENT_DATE)
      `,
      db`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE type = 'income' AND date >= DATE_TRUNC('month', CURRENT_DATE)
      `,
      db`SELECT COUNT(*) as count FROM expenses`,
      db`
        SELECT category, SUM(amount) as total
        FROM expenses
        WHERE type = 'expense'
        GROUP BY category
        ORDER BY total DESC
      `,
      db`
        SELECT to_char(date, 'YYYY-MM') as month, type, SUM(amount) as total
        FROM expenses
        GROUP BY to_char(date, 'YYYY-MM'), type
        ORDER BY month ASC
      `,
    ]);

    const byMonthMap = new Map<string, { month: string; expense: number; income: number }>();
    for (const row of byMonth) {
      const key = row.month as string;
      const entry = byMonthMap.get(key) || { month: key, expense: 0, income: 0 };
      if (row.type === 'expense') entry.expense += Number(row.total);
      if (row.type === 'income') entry.income += Number(row.total);
      byMonthMap.set(key, entry);
    }

    res.json({
      expenseTotal: Number(expenseTotal[0].total),
      incomeTotal: Number(incomeTotal[0].total),
      balance: Number(incomeTotal[0].total) - Number(expenseTotal[0].total),
      monthExpense: Number(monthExpense[0].total),
      monthIncome: Number(monthIncome[0].total),
      monthBalance: Number(monthIncome[0].total) - Number(monthExpense[0].total),
      count: Number(countRow[0].count),
      byCategory: byCategory.map((c) => ({
        category: c.category,
        total: Number(c.total),
      })),
      byMonth: [...byMonthMap.values()],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;
