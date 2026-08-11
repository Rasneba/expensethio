import { useState, useEffect, useCallback } from 'react';
import { getTodos, addTodo, updateTodo, deleteTodo, Todo, Period } from '../services/api';

const SECTIONS: { period: Period; label: string; icon: string }[] = [
  { period: 'daily', label: 'Daily', icon: '☀️' },
  { period: 'weekly', label: 'Weekly', icon: '📅' },
  { period: 'monthly', label: 'Monthly', icon: '🗓️' },
  { period: 'general', label: 'General', icon: '📌' },
];

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
            <div className="progress-fill" style={{ width: `${pct}%` }} />
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
        <button className="btn primary" onClick={submit}>Add</button>
      </div>

      {todos.length === 0 ? (
        <p className="muted plan-empty">No {section.label.toLowerCase()} tasks yet.</p>
      ) : (
        <ul className="todo-list">
          {todos.map((t) => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <button
                className={`check ${t.done ? 'checked' : ''}`}
                onClick={() => onToggle(t)}
                aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
              >
                {t.done ? '✓' : ''}
              </button>
              <span className="todo-title">{t.title}</span>
              <button className="btn icon danger" onClick={() => onDelete(t.id)} title="Delete">
                🗑️
              </button>
            </li>
          ))}
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

  if (loading) return <p className="muted">Loading plans...</p>;
  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="plans">
      <h2>Plans & Todos</h2>
      {SECTIONS.map((section) => (
        <PlanSection
          key={section.period}
          section={section}
          todos={todos.filter((t) => t.period === section.period)}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onAdd={(title) => handleAdd(section.period, title)}
        />
      ))}
    </div>
  );
}
