import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ExpenseList from './components/ExpenseList';
import ExpenseForm from './components/ExpenseForm';
import Dashboard from './components/Dashboard';
import Assistant from './components/Assistant';
import Plans from './components/Plans';
import CreditTab from './components/CreditTab';

type View = 'dashboard' | 'expenses' | 'add' | 'plans' | 'credit' | 'assistant';

const viewConfig: Record<View, { icon: string; label: string }> = {
  dashboard: { icon: '📊', label: 'Dashboard' },
  expenses: { icon: '🧾', label: 'Transactions' },
  add: { icon: '+', label: 'Add' },
  credit: { icon: '💳', label: 'Credit' },
  plans: { icon: '🗒️', label: 'Plans' },
  assistant: { icon: '🤖', label: 'Assistant' },
};

const navItems: View[] = ['dashboard', 'expenses', 'add', 'credit', 'plans', 'assistant'];

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1],
};

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

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard key="dashboard" />;
      case 'expenses':
        return <ExpenseList key="expenses" refreshKey={refreshKey} />;
      case 'add':
        return <ExpenseForm key="add" onSuccess={afterSave} />;
      case 'plans':
        return <Plans key="plans" />;
      case 'credit':
        return <CreditTab key="credit" />;
      case 'assistant':
        return <Assistant key="assistant" />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">💸</span>
          <h1>ExpenseTracker</h1>
        </div>
        <div className="header-actions">
          <motion.button
            className="btn icon theme-toggle"
            onClick={() => setDark((d) => !d)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            whileTap={{ scale: 0.9, rotate: 15 }}
            whileHover={{ scale: 1.05 }}
          >
            {dark ? '☀️' : '🌙'}
          </motion.button>
        </div>
      </header>

      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="bottom-nav">
        {navItems.map((item) => {
          const config = viewConfig[item];
          const isFab = item === 'add';
          const isActive = view === item;

          return (
            <motion.button
              key={item}
              className={`${isFab ? `add-fab ${isActive ? 'active' : ''}` : isActive ? 'active' : ''}`}
              onClick={() => setView(item)}
              aria-label={isFab ? 'Add transaction' : config.label}
              whileTap={{ scale: isFab ? 0.9 : 0.92 }}
            >
              {isFab ? (
                <span className="fab-plus">+</span>
              ) : (
                <>
                  <motion.span
                    className="nav-icon"
                    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    {config.icon}
                  </motion.span>
                  <span className="nav-label">{config.label}</span>
                </>
              )}
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
