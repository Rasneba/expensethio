import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { getExpenses, getDashboard, DashboardData, Expense } from '../services/api';
import { fmtBirr } from '../utils/currency';

const COLORS = [
  '#0ea5e9', '#38bdf8', '#7dd3fc', '#0284c7', '#0369a1',
  '#60a5fa', '#93c5fd', '#22d3ee', '#67e8f9', '#e0f2fe',
  '#38bdf8', '#0ea5e9',
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [recent, setRecent] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [dash, expenses] = await Promise.all([getDashboard(), getExpenses()]);
      setStats(dash);
      setRecent(expenses.slice(0, 6));
      setError('');
    } catch {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="muted">Loading dashboard...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!stats) return null;

  const fmt = (n: number) =>
    `Br ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const pieData = stats.byCategory;

  return (
    <div className="dash">
      <h2>Dashboard</h2>

      <div className="cards">
        <div className="card income">
          <div className="card-label">Income</div>
          <div className="card-value">{fmt(stats.incomeTotal)}</div>
        </div>
        <div className="card expense">
          <div className="card-label">Expenses</div>
          <div className="card-value">{fmt(stats.expenseTotal)}</div>
        </div>
        <div className={`card ${stats.balance >= 0 ? 'income' : 'expense'}`}>
          <div className="card-label">Balance</div>
          <div className="card-value">{fmt(stats.balance)}</div>
        </div>
        <div className={`card ${stats.creditTotal > 0 ? 'expense' : 'income'}`}>
          <div className="card-label">Credit Owed</div>
          <div className="card-value">{fmt(Math.max(stats.creditTotal, 0))}</div>
        </div>
        <div className="card">
          <div className="card-label">This Month</div>
          <div className="card-value small">
            <span className="income">+{fmt(stats.monthIncome)}</span>
            <span className="expense"> −{fmt(stats.monthExpense)}</span>
            <span className={stats.monthBalance >= 0 ? 'income' : 'expense'}>
              {' '}= {fmt(stats.monthBalance)}
            </span>
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card chart-card">
          <h3>Spending by Category</h3>
          {pieData.length === 0 ? (
            <p className="muted">No expenses yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => fmt(Number(v) || 0)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="cat-bars">
            {pieData.slice(0, 6).map((cat, i) => (
              <div key={cat.category} className="cat-row">
                <span className="cat-dot" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="cat-name">{cat.category}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(cat.total / (pieData[0]?.total || 1)) * 100}%`,
                      background: COLORS[i % COLORS.length],
                    }}
                  />
                </div>
                <span className="cat-total">{fmt(cat.total)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card chart-card">
          <h3>Monthly Trend</h3>
          {stats.byMonth.length === 0 ? (
            <p className="muted">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5f2fb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: unknown, n: unknown) => [fmt(Number(v) || 0), String(n)]}
                  cursor={{ fill: 'rgba(14,165,233,0.08)' }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="card chart-card">
          <h3>Recent Transactions</h3>
          <ul className="recent-list">
            {recent.map((e) => (
              <li key={e.id}>
                <div>
                  <div className="tx-cat">{e.category}</div>
                  <div className="tx-date">
                    {new Date(e.date + 'T00:00:00').toLocaleDateString()}
                    {e.description && e.description !== e.category ? ` · ${e.description}` : ''}
                  </div>
                </div>
                <div className={`tx-amount ${e.type}`}>
                  {e.type === 'income' ? '+' : '-'}{fmtBirr(e.amount)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
