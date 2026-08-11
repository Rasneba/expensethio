import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCredits, addCredit, deleteCredit, Credit, CreditType } from '../services/api';
import { fmtBirr } from '../utils/currency';

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

export default function CreditTab() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState<CreditType>('borrow');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
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
    } finally {
      setSaving(false);
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

  if (loading) return (
    <div className="credit-tab">
      <h2 className="section-title">💳 Credit</h2>
      <div className="stat-cards">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-text" style={{ width: 80, height: 10, marginBottom: 12 }} />
            <div className="skeleton skeleton-text" style={{ width: 100, height: 24 }} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div
      className="credit-tab"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.h2 className="section-title" variants={item}>💳 Credit</motion.h2>

      <motion.div className="stat-cards" variants={item}>
        <motion.div
          className={`stat-card ${outstanding > 0 ? 'expense' : 'income'}`}
          whileHover={{ y: -3 }}
        >
          <div className="stat-icon">{outstanding > 0 ? '🔴' : '✅'}</div>
          <div className="card-label">Outstanding Owed</div>
          <div className="card-value">{fmtBirr(Math.max(outstanding, 0))}</div>
        </motion.div>
        <motion.div className="stat-card expense" whileHover={{ y: -3 }}>
          <div className="stat-icon">📤</div>
          <div className="card-label">Total Borrowed</div>
          <div className="card-value small"><span className="expense">-{fmtBirr(borrowed)}</span></div>
        </motion.div>
        <motion.div className="stat-card income" whileHover={{ y: -3 }}>
          <div className="stat-icon">📥</div>
          <div className="card-label">Paid Back</div>
          <div className="card-value small"><span className="income">+{fmtBirr(paid)}</span></div>
        </motion.div>
      </motion.div>

      <motion.div className="card form-card" variants={item}>
        <h3>Add Credit Entry</h3>
        <div className="type-toggle">
          <motion.button
            type="button"
            className={type === 'borrow' ? 'active expense' : ''}
            onClick={() => setType('borrow')}
            whileTap={{ scale: 0.95 }}
          >
            Borrowed (owed)
          </motion.button>
          <motion.button
            type="button"
            className={type === 'payment' ? 'active income' : ''}
            onClick={() => setType('payment')}
            whileTap={{ scale: 0.95 }}
          >
            Paying off
          </motion.button>
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
              style={{ fontSize: 18, fontWeight: 700 }}
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

          <AnimatePresence>
            {error && (
              <motion.div
                className="error-text"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            className="btn primary"
            disabled={saving}
            whileTap={{ scale: 0.98 }}
          >
            {saving ? 'Adding...' : 'Add Credit Entry'}
          </motion.button>
        </form>
      </motion.div>

      <motion.div className="card" variants={item}>
        <h3>Credit History ({credits.length})</h3>
        {credits.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <span className="empty-icon">💳</span>
            <p className="empty-title">No credit entries yet</p>
            <p className="empty-desc">Add a credit entry above to start tracking.</p>
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
            {credits.map((c) => (
              <motion.div
                key={c.id}
                className="tx-row"
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
                layout
              >
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
                  <motion.button
                    className="btn icon danger"
                    onClick={() => handleDelete(c.id)}
                    title="Delete"
                    whileTap={{ scale: 0.85 }}
                  >
                    🗑️
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
