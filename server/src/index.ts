import express from 'express';
import { neon } from '@neondatabase/serverless';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const db = neon(process.env.DATABASE_URL!);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
}

app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await db`
      SELECT id, amount, category, description, date::text as date, created_at
      FROM expenses
      ORDER BY date DESC, created_at DESC
    `;
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;
    const result = await db`
      INSERT INTO expenses (amount, category, description, date)
      VALUES (${Number(amount)}, ${category}, ${description || ''}, ${date})
      RETURNING id, amount, category, description, date::text as date, created_at
    `;
    res.status(201).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, category, description } = req.body;
    const result = await db`
      UPDATE expenses SET amount = ${amount}, category = ${category}, description = ${description}
      WHERE id = ${id}
      RETURNING id, amount, category, description, date::text as date, created_at
    `;
    res.json(result[0]);
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
    const [totalRow, monthRow, countRow, byCategory] = await Promise.all([
      db`SELECT COALESCE(SUM(amount), 0) as total FROM expenses`,
      db`
        SELECT COALESCE(SUM(amount), 0) as monthtotal
        FROM expenses
        WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
      `,
      db`SELECT COUNT(*) as count FROM expenses`,
      db`
        SELECT category, SUM(amount) as total
        FROM expenses
        GROUP BY category
        ORDER BY total DESC
      `
    ]);
    res.json({
      total: Number(totalRow[0].total),
      monthTotal: Number(monthRow[0].monthtotal),
      count: Number(countRow[0].count),
      byCategory: byCategory.map((c) => ({
        category: c.category,
        total: Number(c.total),
      })),
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