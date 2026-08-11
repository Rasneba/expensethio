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
  created_at: string;
}

const EXPENSE_RETURNING = `id, type, amount, category, description, date::text as date, method, created_at`;
const EXPENSE_RETURNING_RAW = () => new UnsafeRawSql(EXPENSE_RETURNING);
const CREDIT_RETURNING = `id, type, amount, description, date::text as date, due_date::text as due_date, creditor, created_at`;

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
      SELECT id, type, amount, description, date::text as date, due_date::text as due_date, creditor, created_at
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
    const { type, amount, description, date, due_date, creditor } = req.body;
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

    const result = await db`
      INSERT INTO credits (type, amount, description, date, due_date, creditor)
      VALUES (${t}, ${n}, ${description ? String(description) : ''}, ${String(date)}, ${dueDateVal}, ${creditorVal})
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
    const { type, amount, description, date, due_date, creditor } = req.body;
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
