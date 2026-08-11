import { useState, useEffect, useCallback } from 'react';
import { getCredits, addCredit, deleteCredit, Credit, CreditType } from '../services/api';
import { fmtBirr } from '../utils/currency';

export default function CreditTab() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState<CreditType>('borrow');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setCredits(await getCredits());
      setError('');
    } catch {
      setError('Failed to load credits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const borrowed = credits
    .filter((c) => c.type === 'borrow')
    .reduce((s, c) => s + c.amount, 0);
  const paid = credits
    .filter((c) => c.type === 'payment')
    .reduce((s, c) => s + c.amount, 0);
  const outstanding = borrowed - paid;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) {
      setError('Enter a valid amount greater than 0');
      return;
    }
    if (!date) {
      setError('Select a date');
      return;
    }
    try {
      await addCredit({
        type,
        amount: n,
        description: description.trim() || (type === 'borrow' ? 'Credit borrowed' : 'Credit payment'),
        date,
      });
      setAmount('');
      setDescription('');
      setError('');
      load();
    } catch {
      setError('Failed to add credit entry');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this credit entry?')) return;
    try {
      await deleteCredit(id);
      setCredits((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError('Failed to delete credit entry');
    }
  };

  if (loading) return <p className="muted">Loading credit...</p>;

  return (
    <div className="credit-tab">
      <h2>Credit</h2>

      <div className="cards">
        <div className={`card ${outstanding > 0 ? 'expense' : 'income'}`}>
          <div className="card-label">Outstanding Owed</div>
          <div className="card-value">{fmtBirr(Math.max(outstanding, 0))}</div>
        </div>
        <div className="card">
          <div className="card-label">Total Borrowed</div>
          <div className="card-value small"><span className="expense">-{fmtBirr(borrowed)}</span></div>
        </div>
        <div className="card">
          <div className="card-label">Paid Back</div>
          <div className="card-value small"><span className="income">+{fmtBirr(paid)}</span></div>
        </div>
      </div>

      <div className="card form-card">
        <h3>Add Credit Entry</h3>
        <div className="type-toggle">
          <button
            type="button"
            className={type === 'borrow' ? 'active expense' : ''}
            onClick={() => setType('borrow')}
          >
            Borrowed (owed)
          </button>
          <button
            type="button"
            className={type === 'payment' ? 'active income' : ''}
            onClick={() => setType('payment')}
          >
            Paying off
          </button>
        </div>
        <form onSubmit={handleAdd}>
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
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'borrow' ? 'e.g. Borrowed from friend' : 'e.g. Paid back loan'}
            />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button type="submit" className="btn primary">Add Credit Entry</button>
        </form>
      </div>

      <div className="card">
        <h3>Credit History ({credits.length})</h3>
        {credits.length === 0 ? (
          <p className="muted">No credit entries yet.</p>
        ) : (
          <div className="tx-list">
            {credits.map((c) => (
              <div key={c.id} className="tx-row">
                <div className="tx-main">
                  <div className="tx-cat">
                    {c.type === 'borrow' ? 'Borrowed' : 'Credit payment'}
                    <span className={`credit-badge ${c.type === 'borrow' ? 'purchase' : 'payment'}`}>
                      {c.type === 'borrow' ? 'owed' : 'paid'}
                    </span>
                  </div>
                  <div className="tx-desc">
                    {c.description && c.description !== 'Credit borrowed' && c.description !== 'Credit payment'
                      ? c.description
                      : ''}
                  </div>
                  <div className="tx-date">
                    {new Date(c.date + 'T00:00:00').toLocaleDateString()}
                  </div>
                </div>
                <div className={`tx-amount ${c.type === 'borrow' ? 'expense' : 'income'}`}>
                  {c.type === 'borrow' ? `-${fmtBirr(c.amount)}` : `+${fmtBirr(c.amount)}`}
                </div>
                <div className="tx-actions">
                  <button className="btn icon danger" onClick={() => handleDelete(c.id)} title="Delete">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
