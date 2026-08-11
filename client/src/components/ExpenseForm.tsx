import { useState } from 'react';
import { addExpense, updateExpense, addCredit, Expense, TxType, TxMethod } from '../services/api';

interface Props {
  onSuccess: () => void;
  initial?: Expense | null;
}

type Mode = TxType | 'credit';

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
  const [mode, setMode] = useState<Mode>(initial?.type || 'expense');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial?.category || EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState(initial?.description || '');
  const [date, setDate] = useState(initial?.date || new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<TxMethod>(initial?.method || 'cash');
  const [creditType, setCreditType] = useState<'borrow' | 'payment'>('borrow');
  const [error, setError] = useState('');

  const categories = mode === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const switchMode = (m: Mode) => {
    setMode(m);
    if (m === 'income') setCategory((prev) => (INCOME_CATEGORIES.includes(prev) ? prev : INCOME_CATEGORIES[0]));
    if (m === 'expense') setCategory((prev) => (EXPENSE_CATEGORIES.includes(prev) ? prev : EXPENSE_CATEGORIES[0]));
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

    try {
      if (mode === 'credit') {
        if (editing && initial) {
          setError('Credit entries cannot be edited here. Delete and re-add instead.');
          return;
        }
        await addCredit({
          type: creditType,
          amount: numAmount,
          description: description.trim() || (creditType === 'borrow' ? 'Credit borrowed' : 'Credit payment'),
          date,
        });
      } else if (editing && initial) {
        await updateExpense(initial.id, {
          type: mode,
          amount: numAmount,
          category,
          description: description.trim() || category,
          date,
          method,
        });
      } else {
        await addExpense({
          type: mode,
          amount: numAmount,
          category,
          description: description.trim() || category,
          date,
          method,
        });
      }
      onSuccess();
    } catch {
      setError('Failed to save. Please try again.');
    }
  };

  return (
    <div className="card form-card">
      <h2>{editing ? 'Edit Transaction' : 'Add Transaction'}</h2>

      <div className="type-toggle">
        <button
          type="button"
          className={mode === 'expense' ? 'active expense' : ''}
          onClick={() => switchMode('expense')}
        >
          − Expense
        </button>
        <button
          type="button"
          className={mode === 'income' ? 'active income' : ''}
          onClick={() => switchMode('income')}
        >
          + Income
        </button>
        <button
          type="button"
          className={mode === 'credit' ? 'active credit' : ''}
          onClick={() => switchMode('credit')}
        >
          💳 Credit
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'credit' && (
          <div className="type-toggle sub">
            <button
              type="button"
              className={creditType === 'borrow' ? 'active expense' : ''}
              onClick={() => setCreditType('borrow')}
            >
              Borrowed (owed)
            </button>
            <button
              type="button"
              className={creditType === 'payment' ? 'active income' : ''}
              onClick={() => setCreditType('payment')}
            >
              Paying off
            </button>
          </div>
        )}

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

        {mode !== 'credit' && (
          <>
            <div className="field">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Payment Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as TxMethod)}>
                <option value="cash">💵 Cash</option>
                <option value="mobile">📱 Mobile</option>
              </select>
            </div>
          </>
        )}

        <div className="field">
          <label>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              mode === 'credit'
                ? creditType === 'borrow'
                  ? 'e.g. Borrowed from friend'
                  : 'e.g. Paid back loan'
                : mode === 'income'
                ? 'e.g. Monthly salary'
                : 'e.g. Groceries, Gas...'
            }
          />
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
