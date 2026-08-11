import { useState, useEffect } from 'react';
import ExpenseList from './components/ExpenseList';
import ExpenseForm from './components/ExpenseForm';
import Dashboard from './components/Dashboard';
import Assistant from './components/Assistant';

type View = 'dashboard' | 'expenses' | 'add' | 'assistant';

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [dark, setDark] = useState(
    () => localStorage.getItem('theme') === 'dark'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const afterSave = () => {
    setRefreshKey((k) => k + 1);
    setView('expenses');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">💸</span>
          <h1>Expense Tracker</h1>
        </div>
        <div className="header-actions">
          <button
            className="btn icon"
            onClick={() => setDark((d) => !d)}
            title="Toggle theme"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="main">
        {view === 'dashboard' && <Dashboard />}
        {view === 'expenses' && <ExpenseList refreshKey={refreshKey} />}
        {view === 'add' && <ExpenseForm onSuccess={afterSave} />}
        {view === 'assistant' && <Assistant />}
      </main>

      <nav className="bottom-nav">
        <button
          className={view === 'dashboard' ? 'active' : ''}
          onClick={() => setView('dashboard')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </button>
        <button
          className={view === 'expenses' ? 'active' : ''}
          onClick={() => setView('expenses')}
        >
          <span className="nav-icon">🧾</span>
          <span className="nav-label">Transactions</span>
        </button>
        <button
          className={`add-fab ${view === 'add' ? 'active' : ''}`}
          onClick={() => setView('add')}
          aria-label="Add transaction"
        >
          <span className="fab-plus">+</span>
        </button>
        <button
          className={view === 'assistant' ? 'active' : ''}
          onClick={() => setView('assistant')}
        >
          <span className="nav-icon">🤖</span>
          <span className="nav-label">Assistant</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
