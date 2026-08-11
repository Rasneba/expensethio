import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getTodos, updateTodo, Todo } from '../services/api';
import { classifyTodo, formatDue, sortTodos, Bucket } from '../utils/tasks';

const SECTIONS: { key: Bucket; icon: string; label: string }[] = [
  { key: 'overdue', icon: '🔴', label: 'Overdue' },
  { key: 'today', icon: '☀️', label: 'Today' },
  { key: 'upcoming', icon: '📅', label: 'Upcoming' },
];

export default function TasksWidget() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setTodos(await getTodos());
    } catch {
      // silent — widget is supplementary
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buckets = useMemo(() => {
    const g: Record<Bucket, Todo[]> = { today: [], upcoming: [], overdue: [], none: [] };
    for (const t of todos) {
      if (t.status === 'done') continue;
      g[classifyTodo(t)].push(t);
    }
    return g;
  }, [todos]);

  const counts = useMemo(
    () => ({ today: buckets.today.length, upcoming: buckets.upcoming.length, overdue: buckets.overdue.length }),
    [buckets]
  );
  const totalOpen = counts.today + counts.upcoming + counts.overdue;

  const toggle = async (t: Todo) => {
    const next = t.status === 'done' ? 'todo' : 'done';
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next, done: next === 'done' } : x)));
    try {
      const updated = await updateTodo(t.id, { status: next });
      setTodos((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch {
      setTodos((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    }
  };

  if (!loaded) return null;

  return (
    <motion.div className="card tasks-widget" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="tasks-widget-header">
        <h3>TASKS</h3>
        <div className="tasks-counts">
          <span>☀️ {counts.today}</span>
          <span>📅 {counts.upcoming}</span>
          <span>🔴 {counts.overdue}</span>
        </div>
      </div>
      {totalOpen === 0 ? (
        <p className="muted" style={{ padding: '12px 0 4px' }}>All caught up!</p>
      ) : (
        <ul className="tasks-widget-list">
          {SECTIONS.map((s) => {
            const list = sortTodos(buckets[s.key]).slice(0, 5);
            if (!list.length) return null;
            return (
              <li key={s.key} className="tasks-widget-section">
                <div className="tasks-widget-section-label">{s.icon} {s.label}</div>
                {list.map((t) => (
                  <button key={t.id} className="tasks-widget-item" onClick={() => toggle(t)}>
                    <span className={`task-check ${t.status === 'done' ? 'checked' : ''}`}>
                      {t.status === 'done' ? '✓' : ''}
                    </span>
                    <span className="tasks-widget-title">{t.title}</span>
                    {t.due_at && <span className="tasks-widget-when">{formatDue(t.due_at)}</span>}
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}
