import { useState, useEffect, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCredits, addCredit, updateCredit, deleteCredit, Credit, CreditType } from '../services/api';
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

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function DueBadge({ dueDate }: { dueDate: string }) {
  const days = daysUntil(dueDate);
  if (days < 0) {
    return <span className="credit-badge purchase">overdue {Math.abs(days)}d</span>;
  }
  if (days === 0) {
    return <span className="credit-badge purchase">due today</span>;
  }
  if (days <= 7) {
    return <span className="credit-badge" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>due in {days}d</span>;
  }
  return <span className="credit-badge" style={{ background: 'var(--primary-soft)', color: 'var(--primary-strong)' }}>due {new Date(dueDate + 'T00:00:00').toLocaleDateString()}</span>;
}

export default function CreditTab() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [type, setType] = useState<CreditType>('borrow');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [creditor, setCreditor] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payDescription, setPayDescription] = useState('');
  const [paySaving, setPaySaving] = useState(false);

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

  const upcomingDue = credits
    .filter((c) => c.type === 'borrow' && c.due_date && daysUntil(c.due_date) >= 0 && daysUntil(c.due_date) <= 14)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  const overdue = credits
    .filter((c) => c.type === 'borrow' && c.due_date && daysUntil(c.due_date) < 0);

  const paidByCredit = new Map<string, number>();
  for (const c of credits) {
    if (c.type === 'payment' && c.payoff_of) {
      paidByCredit.set(c.payoff_of, (paidByCredit.get(c.payoff_of) || 0) + c.amount);
    }
  }
  const remainingByCredit = (b: Credit): number => {
    if (b.type !== 'borrow') return 0;
    return Math.max(b.amount - (paidByCredit.get(b.id) || 0), 0);
  };

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setDueDate('');
    setCreditor('');
    setDate(new Date().toISOString().split('T')[0]);
    setType('borrow');
    setEditingId(null);
  };

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
      if (editingId) {
        const current = credits.find((c) => c.id === editingId);
        await updateCredit(editingId, {
          type,
          amount: n,
          description: description.trim() || (type === 'borrow' ? 'Credit borrowed' : 'Credit payment'),
          date,
          due_date: dueDate || null,
          creditor: creditor.trim(),
          payoff_of: current?.payoff_of ?? null,
        });
      } else {
        await addCredit({
          type,
          amount: n,
          description: description.trim() || (type === 'borrow' ? 'Credit borrowed' : 'Credit payment'),
          date,
          due_date: dueDate || null,
          creditor: creditor.trim(),
          payoff_of: null,
        });
      }
      resetForm();
      setError('');
      load();
    } catch {
      setError(editingId ? 'Failed to update credit entry' : 'Failed to add credit entry');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (c: Credit) => {
    setEditingId(c.id);
    setType(c.type);
    setAmount(String(c.amount));
    setDescription(c.description);
    setDate(c.date);
    setDueDate(c.due_date || '');
    setCreditor(c.creditor || '');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this credit entry?')) return;
    try {
      await deleteCredit(id);
      setCredits((prev) => prev.filter((c) => c.id !== id));
      if (editingId === id) resetForm();
    } catch {
      setError('Failed to delete credit entry');
    }
  };

  const handlePayOffStart = (c: Credit) => {
    setPayAmount(String(remainingByCredit(c) || c.amount));
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayDescription('');
    setError('');
    setPayingId(c.id);
  };

  const handlePayOffSubmit = async (e: React.FormEvent, c: Credit) => {
    e.preventDefault();
    const n = parseFloat(payAmount);
    if (isNaN(n) || n <= 0) {
      setError('Enter a valid amount greater than 0');
      return;
    }
    if (!payDate) {
      setError('Select a date');
      return;
    }
    setPaySaving(true);
    try {
      await addCredit({
        type: 'payment',
        amount: n,
        description: payDescription.trim() || `Paid back ${c.creditor || 'loan'}`,
        date: payDate,
        due_date: null,
        creditor: c.creditor || '',
        payoff_of: c.id,
      });
      setPayingId(null);
      setError('');
      load();
    } catch {
      setError('Failed to record payment');
    } finally {
      setPaySaving(false);
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
      <motion.h2 className="section-title" variants={item}>💳 Credit Management</motion.h2>

      {/* ── Summary Cards ── */}
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

      {/* ── Overdue / Upcoming Warnings ── */}
      {(overdue.length > 0 || upcomingDue.length > 0) && (
        <motion.div className="card" variants={item} style={{ borderColor: overdue.length > 0 ? 'var(--danger)' : 'var(--warning)' }}>
          <h3>{overdue.length > 0 ? '🚨 Overdue Payments' : '⏰ Upcoming Payments'}</h3>
          <div className="tx-list">
            {overdue.map((c) => (
              <div key={c.id} className="tx-row" style={{ borderColor: 'var(--danger)' }}>
                <div className="tx-main">
                  <div className="tx-cat">
                    {c.creditor || 'Unknown'}
                    <DueBadge dueDate={c.due_date!} />
                  </div>
                  <div className="tx-desc">{c.description}</div>
                </div>
                <div className="tx-amount expense">{fmtBirr(c.amount)}</div>
              </div>
            ))}
            {upcomingDue.map((c) => (
              <div key={c.id} className="tx-row">
                <div className="tx-main">
                  <div className="tx-cat">
                    {c.creditor || 'Unknown'}
                    <DueBadge dueDate={c.due_date!} />
                  </div>
                  <div className="tx-desc">{c.description}</div>
                </div>
                <div className="tx-amount expense">{fmtBirr(c.amount)}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Add / Edit Form ── */}
      <motion.div className="card form-card" variants={item}>
        <h3>{editingId ? '✏️ Edit Credit Entry' : 'Add Credit Entry'}</h3>
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
            <label>{type === 'borrow' ? 'Who lent you?' : 'Who did you pay?'}</label>
            <input
              type="text"
              value={creditor}
              onChange={(e) => setCreditor(e.target.value)}
              placeholder="e.g. Abebe, Bank, Friend..."
            />
          </div>

          <div className="field">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'borrow' ? 'e.g. Borrowed for rent' : 'e.g. Paid back loan'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Due Date (optional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
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

          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              type="submit"
              className="btn primary"
              disabled={saving}
              whileTap={{ scale: 0.98 }}
              style={{ flex: 1 }}
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Credit Entry'}
            </motion.button>
            {editingId && (
              <motion.button
                type="button"
                className="btn"
                onClick={resetForm}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
            )}
          </div>
        </form>
      </motion.div>

      {/* ── Credit History ── */}
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
              <Fragment key={c.id}>
                <motion.div
                  className="tx-row"
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0 },
                  }}
                  layout
                >
                  <div className="tx-main">
                    <div className="tx-cat">
                      {c.creditor || (c.type === 'borrow' ? 'Borrowed' : 'Credit payment')}
                      <span className={`credit-badge ${c.type === 'borrow' ? 'purchase' : 'payment'}`}>
                        {c.type === 'borrow' ? 'owed' : 'paid'}
                      </span>
                      {c.due_date && c.type === 'borrow' && <DueBadge dueDate={c.due_date} />}
                    </div>
                    <div className="tx-desc">
                      {c.description && c.description !== 'Credit borrowed' && c.description !== 'Credit payment'
                        ? c.description
                        : ''}
                    </div>
                    <div className="tx-date">
                      {new Date(c.date + 'T00:00:00').toLocaleDateString()}
                      {c.type === 'borrow' && (
                        <span className="credit-remaining">
                          {' · '}
                          {remainingByCredit(c) > 0 ? `remaining ${fmtBirr(remainingByCredit(c))}` : 'paid off ✅'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`tx-amount ${c.type === 'borrow' ? 'expense' : 'income'}`}>
                    {c.type === 'borrow' ? `-${fmtBirr(c.amount)}` : `+${fmtBirr(c.amount)}`}
                  </div>
                  <div className="tx-actions">
                    {c.type === 'borrow' && remainingByCredit(c) > 0 && (
                      <motion.button
                        className="btn pay-off-btn"
                        onClick={() => handlePayOffStart(c)}
                        title="Pay off this credit"
                        whileTap={{ scale: 0.85 }}
                      >
                        💸 Pay off
                      </motion.button>
                    )}
                    <motion.button
                      className="btn icon"
                      onClick={() => handleEdit(c)}
                      title="Edit"
                      whileTap={{ scale: 0.85 }}
                    >
                      ✏️
                    </motion.button>
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
                <AnimatePresence>
                  {payingId === c.id && (
                    <motion.div
                      className="payoff-form"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <form onSubmit={(e) => handlePayOffSubmit(e, c)}>
                        <div className="payoff-title">
                          💸 Paying off {c.creditor || 'Unknown'}
                          <span className="credit-remaining">
                            (remaining {fmtBirr(remainingByCredit(c))})
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div className="field payoff-field">
                            <label>Amount (Br)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              placeholder="0.00"
                              required
                              style={{ fontSize: 16, fontWeight: 700 }}
                            />
                          </div>
                          <div className="field payoff-field">
                            <label>Date</label>
                            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
                          </div>
                        </div>
                        <div className="field payoff-field">
                          <label>Description</label>
                          <input
                            type="text"
                            value={payDescription}
                            onChange={(e) => setPayDescription(e.target.value)}
                            placeholder={`e.g. Paid back ${c.creditor || 'loan'}`}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <motion.button
                            type="submit"
                            className="btn primary payoff-save"
                            disabled={paySaving}
                            whileTap={{ scale: 0.98 }}
                          >
                            {paySaving ? 'Saving...' : 'Record Payment'}
                          </motion.button>
                          <motion.button
                            type="button"
                            className="btn"
                            onClick={() => setPayingId(null)}
                            whileTap={{ scale: 0.98 }}
                          >
                            Cancel
                          </motion.button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Fragment>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
