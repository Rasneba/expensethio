import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  deleteBudget,
  getReports,
  ReportFilters,
  ReportsData,
  saveBudget,
} from '../services/api';

type ReportTab = 'overview' | 'expense' | 'income' | 'credit' | 'budget' | 'monthly';

const tabs: Array<{ id: ReportTab; label: string; icon: string }> = [
  { id: 'overview', label: 'Dashboard', icon: '📊' },
  { id: 'expense', label: 'Expenses', icon: '📉' },
  { id: 'income', label: 'Income', icon: '📈' },
  { id: 'credit', label: 'Credit', icon: '💳' },
  { id: 'budget', label: 'Budget', icon: '🎯' },
  { id: 'monthly', label: 'Monthly', icon: '🗓️' },
];

const money = (value: number) =>
  new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 2 }).format(value || 0);

const currentMonth = () => new Date().toISOString().slice(0, 7);

function Metric({ label, value, tone = '', icon }: { label: string; value: string; tone?: string; icon: string }) {
  return (
    <div className={`report-metric ${tone}`}>
      <span className="report-metric-icon">{icon}</span>
      <span className="report-metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Breakdown({ rows, total, nameKey = 'category' }: { rows: Array<Record<string, unknown>>; total: number; nameKey?: string }) {
  if (!rows.length) return <div className="report-empty">No data for this period.</div>;
  return (
    <div className="report-breakdown">
      {rows.map((row, index) => {
        const value = Number(row.total);
        const percent = total ? (value / total) * 100 : 0;
        return (
          <div className="report-breakdown-row" key={`${String(row[nameKey])}-${index}`}>
            <div className="report-breakdown-head">
              <span>{String(row[nameKey])}</span>
              <strong>{money(value)} <small>{percent.toFixed(1)}%</small></strong>
            </div>
            <div className="report-bar"><span style={{ width: `${Math.min(percent, 100)}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function Reports() {
  const [tab, setTab] = useState<ReportTab>('overview');
  const [filters, setFilters] = useState<ReportFilters>({ period: 'month', month: currentMonth() });
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getReports(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reports');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => {
    if (!data) return [];
    return [...new Set([...data.expense.byCategory.map((x) => x.category), ...data.income.bySource.map((x) => x.source)])].sort();
  }, [data]);

  const changeFilter = (key: keyof ReportFilters, value: string) => {
    setFilters((old) => ({ ...old, [key]: value || undefined }));
  };

  const submitBudget = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(budgetAmount);
    if (!budgetCategory.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    setError('');
    try {
      await saveBudget({ category: budgetCategory.trim(), amount, month: filters.month || currentMonth() });
      setBudgetCategory('');
      setBudgetAmount('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save budget');
    } finally {
      setSaving(false);
    }
  };

  const removeBudget = async (id: string) => {
    if (!window.confirm('Delete this budget?')) return;
    try {
      await deleteBudget(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete budget');
    }
  };

  return (
    <section className="reports">
      <div className="report-heading">
        <div>
          <h2 className="section-title"><span className="icon">📑</span> Reports</h2>
          <p>Understand cash flow, spending, credit, and monthly plans.</p>
        </div>
      </div>

      <div className="report-tabs" role="tablist" aria-label="Report type">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)} role="tab" aria-selected={tab === item.id}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>

      <div className="card report-filters">
        <div className="field">
          <label htmlFor="report-period">Period</label>
          <select id="report-period" value={filters.period || 'all'} onChange={(e) => changeFilter('period', e.target.value)}>
            <option value="all">All time</option><option value="week">Last 7 days</option><option value="month">This month</option><option value="year">This year</option>
          </select>
        </div>
        <div className="field"><label htmlFor="report-from">From</label><input id="report-from" type="date" value={filters.from || ''} onChange={(e) => changeFilter('from', e.target.value)} /></div>
        <div className="field"><label htmlFor="report-to">To</label><input id="report-to" type="date" value={filters.to || ''} onChange={(e) => changeFilter('to', e.target.value)} /></div>
        <div className="field">
          <label htmlFor="report-category">Category</label>
          <select id="report-category" value={filters.category || ''} onChange={(e) => changeFilter('category', e.target.value)}>
            <option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="report-method">Method</label>
          <select id="report-method" value={filters.method || ''} onChange={(e) => changeFilter('method', e.target.value)}>
            <option value="">All methods</option><option value="cash">Cash</option><option value="mobile">Mobile</option>
          </select>
        </div>
      </div>

      {error && <p className="error-text">⚠️ {error}</p>}
      {loading && <div className="card report-loading"><div className="skeleton report-skeleton" /><div className="skeleton report-skeleton" /></div>}

      {!loading && data && (
        <motion.div className="report-content" key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {tab === 'overview' && <>
            <div className="report-metrics four">
              <Metric icon="↗️" label="Income" value={money(data.overview.income)} tone="positive" />
              <Metric icon="↘️" label="Expenses" value={money(data.overview.expense)} tone="negative" />
              <Metric icon="💳" label="Credit owed" value={money(data.overview.creditOwed)} tone="warning" />
              <Metric icon="💰" label="Available" value={money(data.overview.availableBalance)} tone={data.overview.availableBalance >= 0 ? 'positive' : 'negative'} />
            </div>
            <div className="card">
              <h2>Financial flow</h2>
              <div className="report-flow">
                <div><span>Income</span><strong className="income">+ {money(data.overview.income)}</strong></div>
                <div><span>Expenses (incl. credit payments)</span><strong className="expense">− {money(data.overview.expense)}</strong></div>
                <div className="total"><span>Available balance</span><strong>{money(data.overview.availableBalance)}</strong></div>
                <div><span>Borrowed (cash in)</span><strong className="income">+ {money(data.overview.borrowed)}</strong></div>
                <div><span>Outstanding liability</span><strong className="expense">− {money(data.overview.creditOwed)}</strong></div>
              </div>
            </div>
          </>}

          {tab === 'expense' && <>
            <div className="report-metrics four">
              <Metric icon="💸" label="Total spent" value={money(data.expense.total)} tone="negative" />
              <Metric icon="🧾" label="Transactions" value={String(data.expense.count)} />
              <Metric icon="📐" label="Average" value={money(data.expense.average)} />
              <Metric icon="🔺" label="Largest" value={money(data.expense.largest)} tone="negative" />
            </div>
            <div className="report-grid">
              <div className="card"><h2>By category</h2><Breakdown rows={data.expense.byCategory} total={data.expense.total} /></div>
              <div className="card"><h2>By payment method</h2><Breakdown rows={data.expense.byMethod} total={data.expense.total} nameKey="method" /></div>
            </div>
          </>}

          {tab === 'income' && <>
            <div className="report-metrics"><Metric icon="📈" label="Total income" value={money(data.income.total)} tone="positive" /><Metric icon="🧾" label="Transactions" value={String(data.income.count)} /></div>
            <div className="card"><h2>Income by source</h2><Breakdown rows={data.income.bySource} total={data.income.total} nameKey="source" /></div>
          </>}

          {tab === 'credit' && <>
            <div className="report-metrics three">
              <Metric icon="🏦" label="Total borrowed" value={money(data.credit.borrowed)} />
              <Metric icon="✅" label="Total paid" value={money(data.credit.paid)} tone="positive" />
              <Metric icon="💳" label="Outstanding" value={money(data.credit.outstanding)} tone="warning" />
              <Metric icon="⏰" label="Overdue amount" value={money(data.credit.overdueAmount)} tone="negative" />
              <Metric icon="🚨" label="Overdue loans" value={String(data.credit.overdueCount)} tone="negative" />
              <Metric icon="🔔" label="Due in 7 days" value={String(data.credit.dueSoonCount)} tone="warning" />
            </div>
            <div className="card"><h2>Credit history</h2>
              {data.credit.history.length ? <div className="report-history">{data.credit.history.map((item) => <div key={item.id}><span><strong>{item.creditor || item.description || 'Credit'}</strong><small>{item.date}{item.due_date ? ` · due ${item.due_date}` : ''}</small></span><b className={item.type === 'payment' ? 'income' : 'expense'}>{item.type === 'payment' ? '−' : '+'} {money(item.amount)}</b></div>)}</div> : <div className="report-empty">No credit activity for this period.</div>}
            </div>
          </>}

          {tab === 'budget' && <>
            <div className="card budget-form-card">
              <div><h2>Plan a monthly budget</h2><p>Adding the same category again updates its planned amount.</p></div>
              <form className="budget-form" onSubmit={submitBudget}>
                <div className="field"><label htmlFor="budget-month">Month</label><input id="budget-month" type="month" value={filters.month || currentMonth()} onChange={(e) => changeFilter('month', e.target.value)} required /></div>
                <div className="field"><label htmlFor="budget-category">Category</label><input id="budget-category" value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)} placeholder="e.g. Food" required /></div>
                <div className="field"><label htmlFor="budget-amount">Planned amount</label><input id="budget-amount" type="number" min="0.01" step="0.01" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} placeholder="ETB 0.00" required /></div>
                <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save budget'}</button>
              </form>
            </div>
            <BudgetTable data={data} onDelete={removeBudget} />
          </>}

          {tab === 'monthly' && <>
            <div className="card report-month-select"><div><h2>Monthly financial report</h2><p>Review one calendar month at a time.</p></div><div className="field"><label htmlFor="monthly-month">Month</label><input id="monthly-month" type="month" value={filters.month || currentMonth()} onChange={(e) => changeFilter('month', e.target.value)} /></div></div>
            <div className="report-metrics four">
              <Metric icon="📈" label="Income" value={money(data.monthly.income)} tone="positive" />
              <Metric icon="📉" label="Expenses" value={money(data.monthly.expense)} tone="negative" />
              <Metric icon="💳" label="Credit payments" value={money(data.monthly.creditPayments)} />
              <Metric icon="💰" label="Remaining" value={money(data.monthly.remaining)} tone={data.monthly.remaining >= 0 ? 'positive' : 'negative'} />
            </div>
            <div className="report-grid"><div className="card"><h2>Top categories</h2><Breakdown rows={data.monthly.byCategory} total={data.monthly.expense} /></div><BudgetTable data={data} onDelete={removeBudget} compact /></div>
          </>}
        </motion.div>
      )}
    </section>
  );
}

function BudgetTable({ data, onDelete, compact = false }: { data: ReportsData; onDelete: (id: string) => void; compact?: boolean }) {
  const budgets = data.monthly.budgets;
  return <div className="card budget-table-card"><h2>{compact ? 'Budget vs actual' : `Budget performance · ${data.monthly.month}`}</h2>
    {budgets.length ? <div className="budget-table-wrap"><table className="budget-table"><thead><tr><th>Category</th><th>Planned</th><th>Actual</th><th>Used</th>{!compact && <th />}</tr></thead><tbody>{budgets.map((item) => {
      const percent = item.percentage || 0;
      const status = percent > 100 ? 'over' : percent >= 80 ? 'near' : 'safe';
      return <tr key={item.id}><td>{item.category}</td><td>{money(item.amount)}</td><td>{money(item.actual || 0)}</td><td><span className={`budget-status ${status}`}>{percent.toFixed(0)}%</span></td>{!compact && <td><button className="btn icon danger" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.category} budget`}>🗑️</button></td>}</tr>;
    })}</tbody></table></div> : <div className="report-empty">No budgets set for this month.</div>}
  </div>;
}

export default Reports;
