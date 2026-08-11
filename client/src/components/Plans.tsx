import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTodos, addTodo, updateTodo, deleteTodo, Todo, Period } from '../services/api';

const SECTIONS: { period: Period; label: string; icon: string }[] = [
  { period: 'daily', label: 'Daily', icon: '☀️' },
  { period: 'weekly', label: 'Weekly', icon: '📅' },
  { period: 'monthly', label: 'Monthly', icon: '🗓️' },
  { period: 'general', label: 'General', icon: '📌' },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
};

function PlanSection({
  section,
  todos,
  onToggle,
  onDelete,
  onAdd,
}: {
  section: { period: Period; label: string; icon: string };
  todos: Todo[];
  onToggle: (t: Todo) => void;
  onDelete: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState('');
  const doneCount = todos.filter((t) => t.done).length;
  const pct = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;

  const submit = () => {
    const text = title.trim();
    if (!text) return;
    onAdd(text);
    setTitle('');
  };

  return (
    <div className="card plan-card">
      <div className="plan-header">
        <div className="plan-title">
          <span className="plan-icon">{section.icon}</span>
          <h3>{section.label}</h3>
          {todos.length > 0 && (
            <span className="plan-count">
              {doneCount}/{todos.length}
            </span>
          )}
        </div>
        {todos.length > 0 && (
          <div className="progress-track">
            <motion.div
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        )}
      </div>

      <div className="add-todo">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={`Add to ${section.label.toLowerCase()} plan...`}
        />
        <motion.button
          className="btn primary"
          onClick={submit}
          whileTap={{ scale: 0.95 }}
        >
          Add
        </motion.button>
      </div>

      {todos.length === 0 ? (
        <p className="muted plan-empty">No {section.label.toLowerCase()} tasks yet.</p>
      ) : (
        <ul className="todo-list">
          <AnimatePresence initial={false}>
            {todos.map((t) => (
              <motion.li
                key={t.id}
                className={t.done ? 'done' : ''}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                layout
              >
                <motion.button
                  className={`check ${t.done ? 'checked' : ''}`}
                  onClick={() => onToggle(t)}
                  aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                  whileTap={{ scale: 0.8 }}
                >
                  {t.done ? '✓' : ''}
                </motion.button>
                <span className="todo-title">{t.title}</span>
                <motion.button
                  className="btn icon danger"
                  onClick={() => onDelete(t.id)}
                  title="Delete"
                  whileTap={{ scale: 0.8 }}
                >
                  🗑️
                </motion.button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

export default function Plans() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setTodos(await getTodos());
      setError('');
    } catch {
      setError('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (t: Todo) => {
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    try {
      await updateTodo(t.id, { done: !t.done });
    } catch {
      setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: t.done } : x)));
      setError('Failed to update task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError('Failed to delete task');
    }
  };

  const handleAdd = async (period: Period, title: string) => {
    try {
      const created = await addTodo(title, period);
      setTodos((prev) => [created, ...prev]);
      setError('');
    } catch {
      setError('Failed to add task');
    }
  };

  if (loading) return (
    <div className="plans">
      <h2 className="section-title">🗒️ Plans & Todos</h2>
      {SECTIONS.map((section) => (
        <div key={section.period} className="skeleton-card" style={{ minHeight: 120 }}>
          <div className="skeleton skeleton-text" style={{ width: 100, marginBottom: 16 }} />
          <div className="skeleton skeleton-text" style={{ width: '100%', height: 38, borderRadius: 10, marginBottom: 10 }} />
          <div className="skeleton skeleton-text" style={{ width: '80%', height: 32, borderRadius: 10 }} />
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div className="empty-state">
      <span className="empty-icon">⚠️</span>
      <p className="empty-title">Something went wrong</p>
      <p className="empty-desc">{error}</p>
      <button className="btn" style={{ marginTop: 16 }} onClick={load}>Try Again</button>
    </div>
  );

  return (
    <motion.div
      className="plans"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.h2 className="section-title" variants={item}>🗒️ Plans & Todos</motion.h2>
      {SECTIONS.map((section) => (
        <motion.div key={section.period} variants={item}>
          <PlanSection
            section={section}
            todos={todos.filter((t) => t.period === section.period)}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onAdd={(title) => handleAdd(section.period, title)}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
