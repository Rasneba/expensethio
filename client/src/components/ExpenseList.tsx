import { useState, useEffect, useCallback } from 'react';
import { getExpenses, deleteExpense, Expense } from '../services/api';
import { fmtBirr } from '../utils/currency';
import ExpenseForm from './ExpenseForm';

interface Props {
  refreshKey?: number;
}

export default function ExpenseList({ refreshKey = 0 }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

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
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError('Failed to delete transaction');
    }
  };

  const fmt = (e: Expense) =>
    e.type === 'income' ? `+${fmtBirr(e.amount)}` : `-${fmtBirr(e.amount)}`;

  if (loading) return <p className="muted">Loading transactions...</p>;
  if (error) return <p className="error-text">{error}</p>;

  const methodBadge = (m: string) =>
    m === 'mobile' ? '📱 Mobile' : '💵 Cash';

  return (
    <div>
      <h2>Transactions ({expenses.length})</h2>

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
          <button className="btn" onClick={clearFilter}>Clear</button>
        )}
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditing(null)}>×</button>
            <ExpenseForm
              initial={editing}
              onSuccess={() => {
                setEditing(null);
                load();
              }}
            />
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <p className="muted">No transactions found.</p>
      ) : (
        <div className="tx-list">
          {expenses.map((expense) => (
            <div key={expense.id} className="tx-row">
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
                <button className="btn icon" onClick={() => setEditing(expense)} title="Edit">
                  ✏️
                </button>
                <button className="btn icon danger" onClick={() => handleDelete(expense.id)} title="Delete">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
