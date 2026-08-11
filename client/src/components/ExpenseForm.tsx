import { useState } from 'react';
import { addExpense, updateExpense, Expense, TxType, TxCredit } from '../services/api';

interface Props {
  onSuccess: () => void;
  initial?: Expense | null;
}

const EXPENSE_CATEGORIES = [
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

const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Business',
  'Investment',
  'Gift',
  'Other',
];

export default function ExpenseForm({ onSuccess, initial }: Props) {
  const editing = !!initial;
  const [type, setType] = useState<TxType>(initial?.type || 'expense');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial?.category || EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState(initial?.description || '');
  const [date, setDate] = useState(initial?.date || new Date().toISOString().split('T')[0]);
  const [credit, setCredit] = useState<TxCredit>(initial?.credit || 'none');
  const [error, setError] = useState('');

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const switchType = (t: TxType) => {
    setType(t);
    if (!categories.includes(category)) {
      setCategory((t === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0]);
    }
  };

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

    const payload = {
      type,
      amount: numAmount,
      category,
      description: description.trim() || category,
      date,
      credit,
    };

    try {
      if (editing && initial) {
        await updateExpense(initial.id, payload);
      } else {
        await addExpense(payload);
      }
      onSuccess();
    } catch (err) {
      setError(editing ? 'Failed to update. Please try again.' : 'Failed to add. Please try again.');
    }
  };

  return (
    <div className="card form-card">
      <h2>{editing ? 'Edit Transaction' : 'Add Transaction'}</h2>

      <div className="type-toggle">
        <button
          type="button"
          className={type === 'expense' ? 'active expense' : ''}
          onClick={() => switchType('expense')}
        >
          − Expense
        </button>
        <button
          type="button"
          className={type === 'income' ? 'active income' : ''}
          onClick={() => switchType('income')}
        >
          + Income
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Amount (Br)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === 'income' ? 'e.g. Monthly salary' : 'e.g. Groceries, Gas...'}
          />
        </div>

        <div className="field">
          <label>Payment Method</label>
          <select value={credit} onChange={(e) => setCredit(e.target.value as TxCredit)}>
            <option value="none">Cash / Card</option>
            <option value="purchase">On Credit (borrowed)</option>
            <option value="payment">Credit Payment (pay off credit)</option>
          </select>
        </div>

        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button type="submit" className="btn primary">
          {editing ? 'Save Changes' : 'Save Transaction'}
        </button>
      </form>
    </div>
  );
}
