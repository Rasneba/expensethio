import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { getExpenses, getDashboard, DashboardData, Expense } from '../services/api';
import { fmtBirr } from '../utils/currency';

const COLORS = [
  '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
};

function DashboardSkeleton() {
  return (
    <div className="dash">
      <div className="stat-cards">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-text" style={{ width: 60, height: 10, marginBottom: 12 }} />
            <div className="skeleton skeleton-text" style={{ width: 100, height: 24 }} />
          </div>
        ))}
      </div>
      <div className="chart-grid">
        <div className="skeleton-card" style={{ height: 340 }}>
          <div className="skeleton skeleton-text" style={{ width: 140, height: 14, marginBottom: 20 }} />
          <div className="skeleton" style={{ width: 160, height: 160, borderRadius: '50%', margin: '0 auto' }} />
        </div>
        <div className="skeleton-card" style={{ height: 340 }}>
          <div className="skeleton skeleton-text" style={{ width: 120, height: 14, marginBottom: 20 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 200, padding: '0 20px' }}>
            {[60, 100, 80, 140, 50, 120].map((h, i) => (
              <div key={i} className="skeleton" style={{ flex: 1, height: h, borderRadius: '6px 6px 0 0' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
      setRecent(expenses.slice(0, 5));
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

  if (loading) return <DashboardSkeleton />;
  if (error) return (
    <div className="empty-state">
      <span className="empty-icon">⚠️</span>
      <p className="empty-title">Something went wrong</p>
      <p className="empty-desc">{error}</p>
      <button className="btn" style={{ marginTop: 16 }} onClick={load}>Try Again</button>
    </div>
  );
  if (!stats) return null;

  const pieData = stats.byCategory;

  const statCards = [
    {
      label: 'Income',
      value: fmtBirr(stats.incomeTotal),
      icon: '📈',
      colorClass: 'income',
    },
    {
      label: 'Expenses',
      value: fmtBirr(stats.expenseTotal),
      icon: '📉',
      colorClass: 'expense',
    },
    {
      label: 'Balance',
      value: fmtBirr(stats.balance),
      icon: '💰',
      colorClass: stats.balance >= 0 ? 'balance-positive' : 'balance-negative',
    },
    {
      label: 'Credit Owed',
      value: fmtBirr(Math.max(stats.creditTotal, 0)),
      icon: '💳',
      colorClass: 'credit',
    },
    {
      label: 'This Month',
      value: '',
      icon: '📅',
      colorClass: 'balance-positive',
      isMonth: true,
    },
  ];

  return (
    <motion.div
      className="dash"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div className="stat-cards" variants={item}>
        {statCards.map((card, idx) => (
          <motion.div
            key={card.label}
            className={`stat-card ${card.colorClass}`}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.2 }}
          >
            <div className="stat-icon">{card.icon}</div>
            <div className="card-label">{card.label}</div>
            {card.isMonth ? (
              <div className="card-value small">
                <span className="income">+{fmtBirr(stats.monthIncome)}</span>
                <span className="expense"> −{fmtBirr(stats.monthExpense)}</span>
                <span className={stats.monthBalance >= 0 ? 'income' : 'expense'}>
                  {' '}= {fmtBirr(stats.monthBalance)}
                </span>
              </div>
            ) : (
              <div className="card-value">{card.value}</div>
            )}
          </motion.div>
        ))}
      </motion.div>

      <motion.div className="chart-grid" variants={item}>
        <div className="card chart-card">
          <h3>Spending by Category</h3>
          {pieData.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <span className="empty-icon">📊</span>
              <p className="empty-desc">Add some expenses to see your spending breakdown.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: unknown) => fmtBirr(Number(v) || 0)}
                    contentStyle={{
                      background: 'var(--bg-soft)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      boxShadow: 'var(--card-shadow)',
                      fontSize: 13,
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
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
                    <span className="cat-total">{fmtBirr(cat.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card chart-card">
          <h3>Monthly Trend</h3>
          {stats.byMonth.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <span className="empty-icon">📈</span>
              <p className="empty-desc">Record transactions across months to see trends.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={stats.byMonth} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  formatter={(v: unknown, n: unknown) => [fmtBirr(Number(v) || 0), String(n)]}
                  cursor={{ fill: 'var(--primary-soft)', radius: 6 }}
                  contentStyle={{
                    background: 'var(--bg-soft)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    boxShadow: 'var(--card-shadow)',
                    fontSize: 13,
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[5, 5, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#0ea5e9" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>

      {recent.length > 0 && (
        <motion.div className="card" variants={item}>
          <h3>Recent Transactions</h3>
          <ul className="recent-list">
            {recent.map((e, i) => (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
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
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
}
