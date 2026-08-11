import { useState } from 'react';
import { addExpense, Expense } from '../services/api';

interface Props {
  onSuccess: () => void;
}

const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Housing',
  'Utilities',
  'Healthcare',
  'Education',
  'Travel',
  'Other',
];

export default function ExpenseForm({ onSuccess }: Props) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    if (!date) {
      setError('Please select a date');
      return;
    }

    try {
      await addExpense({
        amount: numAmount,
        category,
        description: description.trim() || category,
        date,
      });
      onSuccess();
    } catch (err) {
      setError('Failed to add expense. Please try again.');
    }
  };

  return (
    <div>
      <h2 style={styles.title}>Add New Expense</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>Amount ($)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={styles.input}
            required
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={styles.input}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Groceries, Gas, Netflix..."
            style={styles.input}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={styles.input}
            required
          />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" style={styles.button}>
          Save Expense
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: { marginBottom: '20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontWeight: 500, fontSize: '14px' },
  input: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    fontSize: '16px',
  },
  error: { color: '#d32f2f', fontSize: '14px' },
  button: {
    padding: '12px',
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};