import { useState } from 'react';
import ExpenseList from './components/ExpenseList';
import ExpenseForm from './components/ExpenseForm';
import Dashboard from './components/Dashboard';

function App() {
  const [view, setView] = useState<'dashboard' | 'expenses' | 'add'>('dashboard');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '20px' }}>
        <h1>Expense Tracker</h1>
        <nav>
          <button onClick={() => setView('dashboard')}>Dashboard</button>
          <button onClick={() => setView('expenses')}>Expenses</button>
          <button onClick={() => setView('add')}>Add Expense</button>
        </nav>
      </header>
      
      {view === 'dashboard' && <Dashboard />}
      {view === 'expenses' && <ExpenseList />}
      {view === 'add' && <ExpenseForm onSuccess={() => setView('expenses')} />}
    </div>
  );
}

export default App;