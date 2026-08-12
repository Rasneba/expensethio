import express from 'express';
import { neon, neonConfig, UnsafeRawSql } from '@neondatabase/serverless';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// Route pool queries over HTTP instead of long-lived WebSockets to avoid
// intermittent failures from stale pooled connections under burst load.
neonConfig.poolQueryViaFetch = true;

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
  method: 'cash' | 'mobile';
  created_at: string;
}

interface Credit {
  id: string;
  type: 'borrow' | 'payment';
  amount: number;
  description: string;
  date: string;
  due_date: string | null;
  creditor: string;
  payoff_of: string | null;
  created_at: string;
}

const EXPENSE_RETURNING = `id, type, amount, category, description, date::text as date, method, created_at`;
const EXPENSE_RETURNING_RAW = () => new UnsafeRawSql(EXPENSE_RETURNING);
const CREDIT_RETURNING = `id, type, amount, description, date::text as date, due_date::text as due_date, creditor, payoff_of::text as payoff_of, created_at`;

const PERIODS = ['daily', 'weekly', 'monthly', 'general'];

type TodoStatus = 'todo' | 'in_progress' | 'done';
type TodoPriority = 'high' | 'medium' | 'low';
type TodoRepeat = 'none' | 'daily' | 'weekday' | 'weekly' | 'monthly' | 'custom';

const TODO_STATUSES: TodoStatus[] = ['todo', 'in_progress', 'done'];
const TODO_PRIORITIES: TodoPriority[] = ['high', 'medium', 'low'];
const TODO_REPEATS: TodoRepeat[] = ['none', 'daily', 'weekday', 'weekly', 'monthly', 'custom'];

interface Todo {
  id: string;
  title: string;
  period: 'daily' | 'weekly' | 'monthly' | 'general';
  done: boolean;
  description: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_at: string | null;
  reminder_minutes: number | null;
  repeat: TodoRepeat;
  repeat_every: number | null;
  repeat_unit: string | null;
  category: string;
  notes: string;
  created_at: string;
}

function parseTodo(row: Record<string, unknown>): Todo {
  const status = (TODO_STATUSES as string[]).includes(String(row.status))
    ? (row.status as TodoStatus)
    : row.done ? 'done' : 'todo';
  return {
    id: String(row.id),
    title: String(row.title),
    period: PERIODS.includes(String(row.period)) ? (row.period as Todo['period']) : 'general',
    done: Boolean(row.done),
    description: String(row.description ?? ''),
    status,
    priority: (TODO_PRIORITIES as string[]).includes(String(row.priority))
      ? (row.priority as TodoPriority)
      : 'medium',
    due_at: row.due_at ? String(row.due_at) : null,
    reminder_minutes: row.reminder_minutes != null ? Number(row.reminder_minutes) : null,
    repeat: (TODO_REPEATS as string[]).includes(String(row.repeat))
      ? (row.repeat as TodoRepeat)
      : 'none',
    repeat_every: row.repeat_every != null ? Number(row.repeat_every) : null,
    repeat_unit: row.repeat_unit ? String(row.repeat_unit) : null,
    category: String(row.category ?? ''),
    notes: String(row.notes ?? ''),
    created_at: String(row.created_at),
  };
}

function advanceDueDate(repeat: TodoRepeat, from: Date, every: number | null, unit: string | null): Date | null {
  if (repeat === 'none') return null;
  const d = new Date(from.getTime());
  const e = repeat === 'custom' ? (every && every > 0 ? every : 1) : 1;
  switch (repeat) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekday':
      do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly': {
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, max));
      break;
    }
    case 'custom': {
      const u = unit === 'week' ? 'week' : unit === 'month' ? 'month' : 'day';
      if (u === 'week') {
        d.setDate(d.getDate() + e * 7);
      } else if (u === 'month') {
        const day = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + e);
        const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, max));
      } else {
        d.setDate(d.getDate() + e);
      }
      break;
    }
    default:
      return null;
  }
  return d;
}

function parseExpense(row: Record<string, unknown>): Expense {
  const method = String(row.method);
  return {
    id: String(row.id),
    type: row.type === 'income' ? 'income' : 'expense',
    amount: Number(row.amount),
    category: String(row.category),
    description: String(row.description),
    date: String(row.date),
    method: method === 'mobile' ? 'mobile' : 'cash',
    created_at: String(row.created_at),
  };
}

function parseCredit(row: Record<string, unknown>): Credit {
  return {
    id: String(row.id),
    type: row.type === 'payment' ? 'payment' : 'borrow',
    amount: Number(row.amount),
    description: String(row.description),
    date: String(row.date),
    due_date: row.due_date ? String(row.due_date) : null,
    creditor: String(row.creditor || ''),
    payoff_of: row.payoff_of ? String(row.payoff_of) : null,
    created_at: String(row.created_at),
  };
}

function toType(value: unknown): 'expense' | 'income' | null {
  if (value === 'income') return 'income';
  if (value === 'expense') return 'expense';
  return null;
}

function toMethod(value: unknown): 'cash' | 'mobile' | null {
  if (value === 'mobile') return 'mobile';
  if (value === 'cash' || value === undefined || value === null) return 'cash';
  return null;
}

function toCreditType(value: unknown): 'borrow' | 'payment' | null {
  if (value === 'borrow') return 'borrow';
  if (value === 'payment') return 'payment';
  return null;
}

function validate(body: Record<string, unknown>, partial: boolean): string | null {
  const { type, amount, category, description, date, method } = body;

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
  if (method !== undefined && toMethod(method) === null) {
    return 'method must be "cash" or "mobile"';
  }
  return null;
}

/* ───────────────────────────────────────
   EXPENSES
   ─────────────────────────────────────── */

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
      `SELECT id, type, amount, category, description, date::text as date, method, created_at
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

    const { amount, category, description, date, type, method } = req.body;
    const result = await db`
      INSERT INTO expenses (type, amount, category, description, date, method)
      VALUES (${toType(type)}, ${Number(amount)}, ${String(category)}, ${description ? String(description) : ''}, ${String(date)}, ${toMethod(method)})
      RETURNING ${EXPENSE_RETURNING_RAW()}
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

    const { amount, category, description, date, type, method } = req.body;
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
    if (method !== undefined) {
      params.push(toMethod(method));
      sets.push(`method = $${params.length}`);
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    params.push(id);
    const result = await db.query(
      `UPDATE expenses SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${EXPENSE_RETURNING}`,
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

/* ───────────────────────────────────────
   DASHBOARD  –  Correct financial model
   ───────────────────────────────────────
   
   Income  →  Available Money
   Expenses ──────────→  Money spent
   Credit/Loans ──────→  Money owed (liability)
   Plans/Budgets ─────→  Money intended to spend
   
   Available Balance = Income + Borrowed − Expenses − Credit Payments
   Credit Owed       = Borrowed − Credit Payments  (liability)
*/

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
          COALESCE(SUM(amount) FILTER (WHERE type = 'borrow'), 0) as borrowed,
          COALESCE(SUM(amount) FILTER (WHERE type = 'payment'), 0) as payments
        FROM credits
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

    const creditBorrowed = Number(creditRow[0].borrowed);
    const creditPayments = Number(creditRow[0].payments);
    const creditOwed = creditBorrowed - creditPayments;

    const inc = Number(incomeTotal[0].total);
    const exp = Number(expenseTotal[0].total);
    const mInc = Number(monthIncome[0].total);
    const mExp = Number(monthExpense[0].total);

    // Correct financial model:
    // Available = Income + Borrowed − Expenses − Credit Payments
    // Credit Owed = Borrowed − Payments (liability, not an expense)
    const availableBalance = inc + creditBorrowed - exp - creditPayments;
    const monthAvailableBalance = mInc + creditBorrowed - mExp - creditPayments;

    res.json({
      incomeTotal: inc,
      expenseTotal: exp,
      creditBorrowed,
      creditPayments,
      creditOwed: Math.max(creditOwed, 0),
      availableBalance,
      monthIncome: mInc,
      monthExpense: mExp,
      monthBalance: mInc - mExp,
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

/* ───────────────────────────────────────
   CREDITS  –  Enhanced with due_date & creditor
   ─────────────────────────────────────── */

app.get('/api/credits', async (req, res) => {
  try {
    const credits = await db`
      SELECT id, type, amount, description, date::text as date, due_date::text as due_date, creditor, payoff_of::text as payoff_of, created_at
      FROM credits
      ORDER BY date DESC, created_at DESC
    `;
    res.json(credits.map(parseCredit));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

app.post('/api/credits', async (req, res) => {
  try {
    const { type, amount, description, date, due_date, creditor, payoff_of } = req.body;
    const t = toCreditType(type);
    if (t === null) {
      return res.status(400).json({ error: 'type must be "borrow" or "payment"' });
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ error: 'description must be a string' });
    }
    if (typeof date !== 'string' || isNaN(Date.parse(date))) {
      return res.status(400).json({ error: 'date must be a valid date' });
    }
    const dueDateVal = due_date && typeof due_date === 'string' && !isNaN(Date.parse(due_date)) ? due_date : null;
    const creditorVal = creditor && typeof creditor === 'string' ? creditor.trim() : '';
    const payoffOfVal = payoff_of && typeof payoff_of === 'string' && /^\d+$/.test(payoff_of) ? payoff_of : null;

    const result = await db`
      INSERT INTO credits (type, amount, description, date, due_date, creditor, payoff_of)
      VALUES (${t}, ${n}, ${description ? String(description) : ''}, ${String(date)}, ${dueDateVal}, ${creditorVal}, ${payoffOfVal})
      RETURNING ${new UnsafeRawSql(CREDIT_RETURNING)}
    `;
    res.status(201).json(parseCredit(result[0]));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create credit' });
  }
});

app.put('/api/credits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, description, date, due_date, creditor, payoff_of } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];
    if (type !== undefined) {
      const t = toCreditType(type);
      if (t === null) {
        return res.status(400).json({ error: 'type must be "borrow" or "payment"' });
      }
      params.push(t);
      sets.push(`type = $${params.length}`);
    }
    if (amount !== undefined) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }
      params.push(n);
      sets.push(`amount = $${params.length}`);
    }
    if (description !== undefined) {
      if (typeof description !== 'string') {
        return res.status(400).json({ error: 'description must be a string' });
      }
      params.push(description);
      sets.push(`description = $${params.length}`);
    }
    if (date !== undefined) {
      if (typeof date !== 'string' || isNaN(Date.parse(date))) {
        return res.status(400).json({ error: 'date must be a valid date' });
      }
      params.push(date);
      sets.push(`date = $${params.length}`);
    }
    if (due_date !== undefined) {
      const dueDateVal = due_date && typeof due_date === 'string' && !isNaN(Date.parse(due_date)) ? due_date : null;
      params.push(dueDateVal);
      sets.push(`due_date = $${params.length}`);
    }
    if (creditor !== undefined) {
      params.push(typeof creditor === 'string' ? creditor.trim() : '');
      sets.push(`creditor = $${params.length}`);
    }
    if (payoff_of !== undefined) {
      const payoffOfVal = payoff_of && typeof payoff_of === 'string' && /^\d+$/.test(payoff_of) ? payoff_of : null;
      params.push(payoffOfVal);
      sets.push(`payoff_of = $${params.length}`);
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    params.push(id);
    const result = await db.query(
      `UPDATE credits SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${CREDIT_RETURNING}`,
      params
    );
    if (!result[0]) {
      return res.status(404).json({ error: 'Credit not found' });
    }
    res.json(parseCredit(result[0]));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update credit' });
  }
});

app.delete('/api/credits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db`DELETE FROM credits WHERE id = ${id}`;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete credit' });
  }
});

/* ───────────────────────────────────────
   REPORTS & MONTHLY BUDGETS
   ─────────────────────────────────────── */

function validMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function reportDateWhere(query: Record<string, unknown>, alias = ''): { sql: string; params: unknown[] } {
  const column = `${alias}date`;
  const clauses: string[] = [];
  const params: unknown[] = [];
  const from = typeof query.from === 'string' && !isNaN(Date.parse(query.from)) ? query.from : '';
  const to = typeof query.to === 'string' && !isNaN(Date.parse(query.to)) ? query.to : '';

  if (from) {
    params.push(from);
    clauses.push(`${column} >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`${column} <= $${params.length}`);
  }
  if (!from && !to) {
    const period = query.period;
    if (period === 'week') clauses.push(`${column} >= CURRENT_DATE - INTERVAL '6 days'`);
    if (period === 'month') clauses.push(`${column} >= DATE_TRUNC('month', CURRENT_DATE)`);
    if (period === 'year') clauses.push(`${column} >= DATE_TRUNC('year', CURRENT_DATE)`);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', params };
}

app.get('/api/budgets', async (req, res) => {
  try {
    const month = validMonth(req.query.month) ? req.query.month : undefined;
    const rows = month
      ? await db`SELECT id, category, amount, to_char(month, 'YYYY-MM') AS month, created_at FROM budgets WHERE month = ${`${month}-01`} ORDER BY category`
      : await db`SELECT id, category, amount, to_char(month, 'YYYY-MM') AS month, created_at FROM budgets ORDER BY month DESC, category`;
    res.json(rows.map((row) => ({ ...row, id: String(row.id), amount: Number(row.amount) })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch budgets. Make sure the latest database schema is applied.' });
  }
});

app.post('/api/budgets', async (req, res) => {
  try {
    const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
    const amount = Number(req.body.amount);
    const month = req.body.month;
    if (!category) return res.status(400).json({ error: 'category is required' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
    if (!validMonth(month)) return res.status(400).json({ error: 'month must use YYYY-MM format' });

    const rows = await db`
      INSERT INTO budgets (category, amount, month)
      VALUES (${category}, ${amount}, ${`${month}-01`})
      ON CONFLICT (category, month) DO UPDATE SET amount = EXCLUDED.amount
      RETURNING id, category, amount, to_char(month, 'YYYY-MM') AS month, created_at
    `;
    const row = rows[0];
    res.status(201).json({ ...row, id: String(row.id), amount: Number(row.amount) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

app.delete('/api/budgets/:id', async (req, res) => {
  try {
    const rows = await db`DELETE FROM budgets WHERE id = ${req.params.id} RETURNING id`;
    if (!rows[0]) return res.status(404).json({ error: 'Budget not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const method = req.query.method === 'cash' || req.query.method === 'mobile' ? req.query.method : '';
    const selectedMonth = validMonth(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
    const dateFilter = reportDateWhere(req.query as Record<string, unknown>);
    const txClauses = [dateFilter.sql];
    const txParams = [...dateFilter.params];
    if (category) {
      txParams.push(category);
      txClauses.push(` AND category = $${txParams.length}`);
    }
    if (method) {
      txParams.push(method);
      txClauses.push(` AND method = $${txParams.length}`);
    }
    const txFilter = txClauses.join('');
    const creditFilter = reportDateWhere(req.query as Record<string, unknown>);

    const [totals, expenseCategories, expenseMethods, incomeSources, transactions, creditTotals, creditHistory, monthlyTotals, monthlyCreditTotals, monthlyCategories, monthBudgets] = await Promise.all([
      db.query(`SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expense,
        COUNT(*) FILTER (WHERE type = 'income') AS income_count,
        COUNT(*) FILTER (WHERE type = 'expense') AS expense_count,
        COALESCE(AVG(amount) FILTER (WHERE type = 'expense'), 0) AS expense_average,
        COALESCE(MAX(amount) FILTER (WHERE type = 'expense'), 0) AS expense_largest
        FROM expenses WHERE 1=1 ${txFilter}`, txParams),
      db.query(`SELECT category, SUM(amount) AS total, COUNT(*) AS count FROM expenses WHERE type = 'expense' ${txFilter} GROUP BY category ORDER BY total DESC`, txParams),
      db.query(`SELECT method, SUM(amount) AS total, COUNT(*) AS count FROM expenses WHERE type = 'expense' ${txFilter} GROUP BY method ORDER BY total DESC`, txParams),
      db.query(`SELECT category AS source, SUM(amount) AS total, COUNT(*) AS count FROM expenses WHERE type = 'income' ${txFilter} GROUP BY category ORDER BY total DESC`, txParams),
      db.query(`SELECT ${EXPENSE_RETURNING} FROM expenses WHERE 1=1 ${txFilter} ORDER BY date DESC, created_at DESC LIMIT 100`, txParams),
      db.query(`SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'borrow'), 0) AS borrowed,
        COALESCE(SUM(amount) FILTER (WHERE type = 'payment'), 0) AS paid,
        COUNT(*) FILTER (WHERE type = 'borrow' AND due_date < CURRENT_DATE) AS overdue_count,
        COUNT(*) FILTER (WHERE type = 'borrow' AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS due_soon_count,
        COALESCE(SUM(amount) FILTER (WHERE type = 'borrow' AND due_date < CURRENT_DATE), 0) AS overdue_borrowed
        FROM credits WHERE 1=1 ${creditFilter.sql}`, creditFilter.params),
      db.query(`SELECT ${CREDIT_RETURNING} FROM credits WHERE 1=1 ${creditFilter.sql} ORDER BY date DESC, created_at DESC LIMIT 100`, creditFilter.params),
      db.query(`SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expense
        FROM expenses WHERE date >= $1::date AND date < ($1::date + INTERVAL '1 month')`, [`${selectedMonth}-01`]),
      db.query(`SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'payment'), 0) AS payments FROM credits WHERE date >= $1::date AND date < ($1::date + INTERVAL '1 month')`, [`${selectedMonth}-01`]),
      db.query(`SELECT category, SUM(amount) AS total FROM expenses WHERE type = 'expense' AND date >= $1::date AND date < ($1::date + INTERVAL '1 month') GROUP BY category ORDER BY total DESC`, [`${selectedMonth}-01`]),
      db.query(`SELECT id, category, amount, to_char(month, 'YYYY-MM') AS month, created_at FROM budgets WHERE month = $1::date ORDER BY category`, [`${selectedMonth}-01`]),
    ]);

    const total = totals[0];
    const credit = creditTotals[0];
    const income = Number(total.income);
    const expense = Number(total.expense);
    const borrowed = Number(credit.borrowed);
    const paid = Number(credit.paid);
    const outstanding = Math.max(borrowed - paid, 0);
    const monthlyIncome = Number(monthlyTotals[0].income);
    const monthlyExpense = Number(monthlyTotals[0].expense);
    const monthlyCreditPayments = Number(monthlyCreditTotals[0].payments);
    const actualByCategory = new Map(monthlyCategories.map((row) => [String(row.category), Number(row.total)]));
    const budgets = monthBudgets.map((row) => {
      const planned = Number(row.amount);
      const actual = actualByCategory.get(String(row.category)) || 0;
      return { id: String(row.id), category: String(row.category), amount: planned, month: String(row.month), actual, percentage: planned ? (actual / planned) * 100 : 0 };
    });

    res.json({
      overview: { income, expense, borrowed, creditPaid: paid, creditOwed: outstanding, availableBalance: income + borrowed - expense - paid },
      expense: {
        total: expense,
        count: Number(total.expense_count),
        average: Number(total.expense_average),
        largest: Number(total.expense_largest),
        byCategory: expenseCategories.map((r) => ({ category: String(r.category), total: Number(r.total), count: Number(r.count) })),
        byMethod: expenseMethods.map((r) => ({ method: String(r.method), total: Number(r.total), count: Number(r.count) })),
        transactions: transactions.filter((r) => r.type === 'expense').map(parseExpense),
      },
      income: {
        total: income,
        count: Number(total.income_count),
        bySource: incomeSources.map((r) => ({ source: String(r.source), total: Number(r.total), count: Number(r.count) })),
        transactions: transactions.filter((r) => r.type === 'income').map(parseExpense),
      },
      credit: {
        borrowed, paid, outstanding,
        overdueAmount: Math.min(Number(credit.overdue_borrowed), outstanding),
        overdueCount: Number(credit.overdue_count),
        dueSoonCount: Number(credit.due_soon_count),
        history: creditHistory.map(parseCredit),
      },
      monthly: {
        month: selectedMonth,
        income: monthlyIncome,
        expense: monthlyExpense,
        creditPayments: monthlyCreditPayments,
        remaining: monthlyIncome - monthlyExpense - monthlyCreditPayments,
        byCategory: monthlyCategories.map((r) => ({ category: String(r.category), total: Number(r.total) })),
        budgets,
      },
      budgets,
    });
  } catch (error) {
    console.error('Report error', error);
    res.status(500).json({ error: 'Failed to generate report. Make sure the latest database schema is applied.' });
  }
});

/* ───────────────────────────────────────
   TODOS
   ─────────────────────────────────────── */

const TODO_SELECT = `id, title, period, done, description, status, priority, due_at, reminder_minutes, repeat, repeat_every, repeat_unit, category, notes, created_at`;
const TODO_SELECT_RAW = () => new UnsafeRawSql(TODO_SELECT);

function validDueAt(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : v;
}

app.get('/api/todos', async (req, res) => {
  try {
    const todos = await db`
      SELECT ${TODO_SELECT_RAW()}
      FROM todos
      ORDER BY (status = 'done') ASC, due_at ASC NULLS LAST, created_at DESC
    `;
    res.json(todos.map(parseTodo));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const { title, period, description, status, priority, due_at, reminder_minutes, repeat, repeat_every, repeat_unit, category, notes } = req.body;
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title must be a non-empty string' });
    }
    const p = PERIODS.includes(String(period)) ? String(period) : 'general';
    const st = (TODO_STATUSES as string[]).includes(String(status)) ? (status as TodoStatus) : 'todo';
    const pr = (TODO_PRIORITIES as string[]).includes(String(priority)) ? (priority as TodoPriority) : 'medium';
    const rp = (TODO_REPEATS as string[]).includes(String(repeat)) ? (repeat as TodoRepeat) : 'none';
    const due = validDueAt(due_at);
    const rem = reminder_minutes === undefined || reminder_minutes === null ? null : Math.max(0, Math.round(Number(reminder_minutes)) || 0);
    const eve = repeat_every === undefined || repeat_every === null ? null : Math.max(1, Math.round(Number(repeat_every)) || 1);
    const unit = repeat_unit === 'week' || repeat_unit === 'month' ? repeat_unit : repeat_unit === 'day' ? 'day' : null;
    const result = await db`
      INSERT INTO todos (title, period, description, status, priority, due_at, reminder_minutes, repeat, repeat_every, repeat_unit, category, notes, done)
      VALUES (${title.trim()}, ${p}, ${String(description ?? '')}, ${st}, ${pr}, ${due}, ${rem}, ${rp}, ${eve}, ${unit}, ${String(category ?? '')}, ${String(notes ?? '')}, ${st === 'done'})
      RETURNING ${TODO_SELECT_RAW()}
    `;
    res.status(201).json(parseTodo(result[0]));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

app.put('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];
    let status: TodoStatus | undefined;
    let repeat: TodoRepeat = 'none';

    const add = (col: string, val: unknown, column: string) => {
      params.push(val);
      sets.push(`${column} = $${params.length}`);
    };

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return res.status(400).json({ error: 'title must be a non-empty string' });
      }
      add('title', body.title.trim(), 'title');
    }
    if (body.description !== undefined) {
      add('description', String(body.description), 'description');
    }
    if (body.status !== undefined) {
      if (!(TODO_STATUSES as string[]).includes(String(body.status))) {
        return res.status(400).json({ error: 'status must be todo, in_progress or done' });
      }
      status = body.status as TodoStatus;
      add('status', status, 'status');
      add('done', status === 'done', 'done');
    } else if (body.done !== undefined) {
      if (typeof body.done !== 'boolean') {
        return res.status(400).json({ error: 'done must be a boolean' });
      }
      status = body.done ? 'done' : 'todo';
      add('done', body.done, 'done');
      add('status', status, 'status');
    }
    if (body.priority !== undefined) {
      if (!(TODO_PRIORITIES as string[]).includes(String(body.priority))) {
        return res.status(400).json({ error: 'priority must be high, medium or low' });
      }
      add('priority', body.priority, 'priority');
    }
    if (body.due_at !== undefined) {
      const due = validDueAt(body.due_at);
      if (body.due_at !== null && body.due_at !== '' && due === null) {
        return res.status(400).json({ error: 'due_at must be a valid date' });
      }
      add('due_at', due, 'due_at');
    }
    if (body.reminder_minutes !== undefined) {
      const rem = body.reminder_minutes === null ? null : Math.max(0, Math.round(Number(body.reminder_minutes)) || 0);
      add('reminder_minutes', rem, 'reminder_minutes');
    }
    if (body.repeat !== undefined) {
      if (!(TODO_REPEATS as string[]).includes(String(body.repeat))) {
        return res.status(400).json({ error: 'repeat must be none, daily, weekday, weekly, monthly or custom' });
      }
      repeat = body.repeat as TodoRepeat;
      add('repeat', repeat, 'repeat');
    }
    if (body.repeat_every !== undefined) {
      const eve = body.repeat_every === null ? null : Math.max(1, Math.round(Number(body.repeat_every)) || 1);
      add('repeat_every', eve, 'repeat_every');
    }
    if (body.repeat_unit !== undefined) {
      const unit = body.repeat_unit === 'week' || body.repeat_unit === 'month' ? body.repeat_unit : body.repeat_unit === 'day' ? 'day' : null;
      add('repeat_unit', unit, 'repeat_unit');
    }
    if (body.category !== undefined) {
      add('category', String(body.category), 'category');
    }
    if (body.notes !== undefined) {
      add('notes', String(body.notes), 'notes');
    }
    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    params.push(id);
    const result = await db.query(
      `UPDATE todos SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${TODO_SELECT}`,
      params
    );
    if (!result[0]) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    let updated = parseTodo(result[0]);

    // Advance-on-complete: completing a recurring task moves it to its next occurrence
    if (updated.status === 'done' && updated.repeat !== 'none') {
      const base = updated.due_at ? new Date(updated.due_at) : new Date();
      const next = advanceDueDate(updated.repeat, base, updated.repeat_every, updated.repeat_unit);
      if (next) {
        const advanced = await db`
          UPDATE todos
          SET status = 'todo', done = false, due_at = ${next.toISOString()}
          WHERE id = ${id}
          RETURNING ${TODO_SELECT_RAW()}
        `;
        updated = parseTodo(advanced[0]);
      }
    }

    res.json(updated);
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
