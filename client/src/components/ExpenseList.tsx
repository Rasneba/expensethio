import { useState, useEffect, useCallback } from 'react';
import { getExpenses, deleteExpense, Expense } from '../services/api';

export default function ExpenseList() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getExpenses();
      setExpenses(data);
      setError('');
    } catch {
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError('Failed to delete expense');
    }
  };

  if (loading) return <p>Loading expenses...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h2 style={styles.title}>Expense History ({expenses.length})</h2>
      {expenses.length === 0 ? (
        <p>No expenses yet. Add your first one!</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{new Date(expense.date + 'T00:00:00').toLocaleDateString()}</td>
                <td>{expense.category}</td>
                <td>{expense.description}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  ${expense.amount.toFixed(2)}
                </td>
                <td>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    style={styles.deleteBtn}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { marginBottom: '20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  deleteBtn: {
    color: '#d32f2f',
    background: 'none',
    border: '1px solid #d32f2f',
    borderRadius: '4px',
    padding: '4px 10px',
    cursor: 'pointer',
  },
};