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
  credit: 'none' | 'purchase' | 'payment';
  created_at: string;
}

const RETURNING = `id, type, amount, category, description, date::text as date, credit, created_at`;
const RETURNING_RAW = () => new UnsafeRawSql(RETURNING);

const PERIODS = ['daily', 'weekly', 'monthly', 'general'];

interface Todo {
  id: string;
  title: string;
  period: 'daily' | 'weekly' | 'monthly' | 'general';
  done: boolean;
  created_at: string;
}

function parseTodo(row: Record<string, unknown>): Todo {
  return {
    id: String(row.id),
    title: String(row.title),
    period: PERIODS.includes(String(row.period)) ? (row.period as Todo['period']) : 'general',
    done: Boolean(row.done),
    created_at: String(row.created_at),
  };
}

function parseExpense(row: Record<string, unknown>): Expense {
  const credit = String(row.credit);
  return {
    id: String(row.id),
    type: row.type === 'income' ? 'income' : 'expense',
    amount: Number(row.amount),
    category: String(row.category),
    description: String(row.description),
    date: String(row.date),
    credit: credit === 'purchase' || credit === 'payment' ? credit : 'none',
    created_at: String(row.created_at),
  };
}

function toCredit(value: unknown): 'none' | 'purchase' | 'payment' | null {
  if (value === 'purchase') return 'purchase';
  if (value === 'payment') return 'payment';
  if (value === 'none' || value === undefined || value === null) return 'none';
  return null;
}

function toType(value: unknown): 'expense' | 'income' | null {
  if (value === 'income') return 'income';
  if (value === 'expense') return 'expense';
  return null;
}

function validate(body: Record<string, unknown>, partial: boolean): string | null {
  const { type, amount, category, description, date, credit } = body;

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
  if (credit !== undefined && toCredit(credit) === null) {
    return 'credit must be "none", "purchase", or "payment"';
  }
  return null;
}

app.get('/api/expenses', async (req, res) => {
  try {
    const { from, to } = req.query;
    const where: string[] = [];
    const params: unknown[] = [];
    if (typeof from === 'string' && from.trim() && !isNaN(Date.parse(from))) {
      params.push(from.trim());
      where.push(`date >= $${params.length}`);
    }
    if (typeof to === 'string' && to.trim() && !isNaN(Date.parse(to))) {
      params.push(to.trim());
      where.push(`date <= $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT id, type, amount, category, description, date::text as date, credit, created_at
       FROM expenses
       ${clause}
       ORDER BY date DESC, created_at DESC`,
      params
    );
    res.json(result.map(parseExpense));
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

    const { amount, category, description, date, type, credit } = req.body;
    const result = await db`
      INSERT INTO expenses (type, amount, category, description, date, credit)
      VALUES (${toType(type)}, ${Number(amount)}, ${String(category)}, ${description ? String(description) : ''}, ${String(date)}, ${toCredit(credit)})
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

    const { amount, category, description, date, type, credit } = req.body;
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
    if (credit !== undefined) {
      params.push(toCredit(credit));
      sets.push(`credit = $${params.length}`);
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
      creditRow,
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
      db`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE credit = 'purchase'), 0) as purchases,
          COALESCE(SUM(amount) FILTER (WHERE credit = 'payment'), 0) as payments
        FROM expenses
        WHERE type = 'expense'
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
      creditTotal: Number(creditRow[0].purchases) - Number(creditRow[0].payments),
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

app.get('/api/todos', async (req, res) => {
  try {
    const todos = await db`
      SELECT id, title, period, done, created_at
      FROM todos
      ORDER BY CASE period
        WHEN 'daily' THEN 1
        WHEN 'weekly' THEN 2
        WHEN 'monthly' THEN 3
        ELSE 4
      END, done ASC, created_at DESC
    `;
    res.json(todos.map(parseTodo));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const { title, period } = req.body;
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title must be a non-empty string' });
    }
    const p = PERIODS.includes(String(period)) ? String(period) : 'general';
    const result = await db`
      INSERT INTO todos (title, period)
      VALUES (${title.trim()}, ${p})
      RETURNING id, title, period, done, created_at
    `;
    res.status(201).json(parseTodo(result[0]));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

app.put('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, done } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }
      params.push(title.trim());
      sets.push(`title = $${params.length}`);
    }
    if (done !== undefined) {
      if (typeof done !== 'boolean') {
        return res.status(400).json({ error: 'done must be a boolean' });
      }
      params.push(done);
      sets.push(`done = $${params.length}`);
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    params.push(id);
    const result = await db.query(
      `UPDATE todos SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id, title, period, done, created_at`,
      params
    );
    if (!result[0]) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    res.json(parseTodo(result[0]));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db`DELETE FROM todos WHERE id = ${id}`;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;
