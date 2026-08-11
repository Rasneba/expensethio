import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getExpenses, deleteExpense, Expense } from '../services/api';
import { fmtBirr } from '../utils/currency';
import ExpenseForm from './ExpenseForm';

interface Props {
  refreshKey?: number;
}

function ListSkeleton() {
  return (
    <div>
      <div className="skeleton skeleton-text" style={{ width: 180, height: 22, marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="skeleton skeleton-text" style={{ width: 150, height: 38, borderRadius: 10 }} />
        <div className="skeleton skeleton-text" style={{ width: 150, height: 38, borderRadius: 10 }} />
      </div>
      <div className="tx-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text" style={{ width: 120 + Math.random() * 60, marginBottom: 8 }} />
              <div className="skeleton skeleton-text-sm" style={{ width: 80 + Math.random() * 40 }} />
            </div>
            <div className="skeleton skeleton-text" style={{ width: 70 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExpenseList({ refreshKey = 0 }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getExpenses(from || undefined, to || undefined);
      setExpenses(data);
      setError('');
    } catch {
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const clearFilter = () => {
    setFrom('');
    setTo('');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this transaction?')) return;
    setDeletingId(id);
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError('Failed to delete transaction');
    } finally {
      setDeletingId(null);
    }
  };

  const fmt = (e: Expense) =>
    e.type === 'income' ? `+${fmtBirr(e.amount)}` : `-${fmtBirr(e.amount)}`;

  if (loading) return <ListSkeleton />;
  if (error) return (
    <div className="empty-state">
      <span className="empty-icon">⚠️</span>
      <p className="empty-title">Something went wrong</p>
      <p className="empty-desc">{error}</p>
      <button className="btn" style={{ marginTop: 16 }} onClick={load}>Try Again</button>
    </div>
  );

  const methodBadge = (m: string) =>
    m === 'mobile' ? '📱 Mobile' : '💵 Cash';

  return (
    <div>
      <h2 className="section-title">🧾 Transactions</h2>

      <div className="filter-bar">
        <div className="field">
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {(from || to) && (
          <motion.button
            className="btn"
            onClick={clearFilter}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            ✕ Clear
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            className="modal-backdrop"
            onClick={() => setEditing(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <button className="modal-close" onClick={() => setEditing(null)}>×</button>
              <ExpenseForm
                initial={editing}
                onSuccess={() => {
                  setEditing(null);
                  load();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {expenses.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🧾</span>
          <p className="empty-title">No transactions yet</p>
          <p className="empty-desc">Tap the + button below to add your first transaction.</p>
        </div>
      ) : (
        <motion.div
          className="tx-list"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.04 } },
          }}
        >
          {expenses.map((expense) => (
            <motion.div
              key={expense.id}
              className="tx-row"
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
              layout
              exit={{ opacity: 0, x: -100 }}
              style={{ opacity: deletingId === expense.id ? 0.5 : 1 }}
            >
              <div className="tx-main">
                <div className="tx-cat">
                  {expense.category}
                  <span className={`credit-badge method-${expense.method}`}>{methodBadge(expense.method)}</span>
                </div>
                <div className="tx-desc">
                  {expense.description && expense.description !== expense.category
                    ? expense.description
                    : ''}
                </div>
                <div className="tx-date">
                  {new Date(expense.date + 'T00:00:00').toLocaleDateString()}
                </div>
              </div>
              <div className={`tx-amount ${expense.type}`}>{fmt(expense)}</div>
              <div className="tx-actions">
                <motion.button
                  className="btn icon"
                  onClick={() => setEditing(expense)}
                  title="Edit"
                  whileTap={{ scale: 0.85 }}
                >
                  ✏️
                </motion.button>
                <motion.button
                  className="btn icon danger"
                  onClick={() => handleDelete(expense.id)}
                  title="Delete"
                  disabled={deletingId === expense.id}
                  whileTap={{ scale: 0.85 }}
                >
                  🗑️
                </motion.button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
