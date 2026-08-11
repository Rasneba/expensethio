import { useState, useEffect, useCallback } from 'react';
import { getExpenses, getDashboard, DashboardData, Expense } from '../services/api';

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

  if (loading) return <p>Loading dashboard...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  const maxCat = stats?.byCategory.length
    ? Math.max(...stats.byCategory.map((c) => c.total))
    : 0;

  return (
    <div>
      <h2 style={styles.title}>Dashboard</h2>

      <div style={styles.cards}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Total Spent</div>
          <div style={styles.cardValue}>
            ${stats?.total ? stats.total.toFixed(2) : '0.00'}
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>This Month</div>
          <div style={styles.cardValue}>
            ${stats?.monthTotal ? stats.monthTotal.toFixed(2) : '0.00'}
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Transactions</div>
          <div style={styles.cardValue}>{stats?.count ?? 0}</div>
        </div>
      </div>

      {stats && stats.byCategory.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.subtitle}>Spending by Category</h3>
          {stats.byCategory.map((cat) => (
            <div key={cat.category} style={styles.catRow}>
              <span style={{ width: 140 }}>{cat.category}</span>
              <div style={styles.barTrack}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${(cat.total / maxCat) * 100}%`,
                  }}
                />
              </div>
              <span style={{ width: 80, textAlign: 'right' }}>
                ${cat.total.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.subtitle}>Recent Expenses</h3>
          <ul style={styles.list}>
            {recent.map((e) => (
              <li key={e.id} style={styles.listItem}>
                <span>{e.description || e.category}</span>
                <span style={{ color: '#666' }}>{e.category}</span>
                <span style={{ fontWeight: 600 }}>${e.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { marginBottom: '20px' },
  cards: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  card: {
    flex: 1,
    minWidth: 160,
    background: '#f5f5f5',
    borderRadius: '8px',
    padding: '20px',
  },
  cardLabel: { fontSize: '13px', color: '#666', marginBottom: '8px' },
  cardValue: { fontSize: '24px', fontWeight: 700 },
  section: { marginBottom: '24px' },
  subtitle: { marginBottom: '12px' },
  catRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' },
  barTrack: {
    flex: 1,
    height: '12px',
    background: '#eee',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: '#4caf50',
    borderRadius: '6px',
  },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 0',
    borderBottom: '1px solid #eee',
  },
};