import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTodos, addTodo, updateTodo, deleteTodo, Todo, TodoInput } from '../services/api';
import { classifyTodo, formatDue, PRIORITY_META, STATUS_META, sortTodos, Bucket } from '../utils/tasks';
import TaskSheet from './TaskSheet';

type View = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';

const VIEWS: { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
];

const SECTION_META: { key: Bucket | 'none' | 'done'; label: string; icon: string }[] = [
  { key: 'overdue', label: 'Overdue', icon: '🔴' },
  { key: 'today', label: 'Today', icon: '☀️' },
  { key: 'upcoming', label: 'Upcoming', icon: '📅' },
  { key: 'none', label: 'No due date', icon: '📌' },
  { key: 'done', label: 'Completed', icon: '✅' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
};

function TaskCard({ todo, onOpen, onToggle }: { todo: Todo; onOpen: () => void; onToggle: () => void }) {
  const bucket = classifyTodo(todo);
  const prio = PRIORITY_META[todo.priority];
  const statusMeta = STATUS_META[todo.status];
  const overdue = todo.status !== 'done' && bucket === 'overdue';

  return (
    <motion.li
      className={`task-card ${todo.status === 'done' ? 'task-done' : ''} ${overdue ? 'task-overdue' : ''}`}
      variants={item}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
    >
      <button
        className="task-check"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={todo.status === 'done' ? 'Mark as not done' : 'Mark as done'}
      >
        {todo.status === 'done' ? '✓' : todo.status === 'in_progress' ? '◐' : ''}
      </button>
      <button className="task-main" onClick={onOpen}>
        <div className="task-top">
          <span className={`prio prio-${todo.priority}`}>
            {prio.dot} {prio.label}
          </span>
          {overdue && <span className="overdue-badge">Overdue</span>}
        </div>
        <div className="task-title">{todo.title}</div>
        {todo.description && <div className="task-desc">{todo.description}</div>}
        <div className="task-meta">
          {todo.due_at && <span className="task-meta-item">📅 {formatDue(todo.due_at)}</span>}
          {todo.category && <span className="task-meta-item">🏷️ {todo.category}</span>}
        </div>
        <div className="task-status">
          <span className="status-dot">{statusMeta.icon}</span>
          {statusMeta.label}
          {todo.repeat !== 'none' && <span className="repeat-badge">🔁 {todo.repeat === 'custom' ? `every ${todo.repeat_every} ${todo.repeat_unit}${todo.repeat_every && todo.repeat_every > 1 ? 's' : ''}` : todo.repeat}</span>}
        </div>
      </button>
    </motion.li>
  );
}

function TaskSection({ label, icon, todos, onOpen, onToggle }: {
  label: string;
  icon: string;
  todos: Todo[];
  onOpen: (t: Todo) => void;
  onToggle: (t: Todo) => void;
}) {
  if (todos.length === 0) return null;
  return (
    <div className="task-section">
      <div className="task-section-header">
        <span className="task-section-icon">{icon}</span>
        <span className="task-section-label">{label}</span>
        <span className="task-section-count">{todos.length}</span>
      </div>
      <ul className="task-list">
        <AnimatePresence initial={false}>
          {sortTodos(todos).map((t) => (
            <TaskCard key={t.id} todo={t} onOpen={() => onOpen(t)} onToggle={() => onToggle(t)} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

export default function Plans() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('all');
  const [sheet, setSheet] = useState<{ open: boolean; todo: Todo | null }>({ open: false, todo: null });

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

  const buckets = useMemo(() => {
    const groups: Record<Bucket | 'none' | 'done', Todo[]> = {
      today: [],
      upcoming: [],
      overdue: [],
      none: [],
      done: [],
    };
    for (const t of todos) {
      if (t.status === 'done') groups.done.push(t);
      else groups[classifyTodo(t)].push(t);
    }
    return groups;
  }, [todos]);

  const summary = useMemo(
    () => ({
      today: buckets.today.length,
      upcoming: buckets.upcoming.length,
      overdue: buckets.overdue.length,
      completed: buckets.done.length,
    }),
    [buckets]
  );

  const handleSave = async (input: TodoInput, id?: string) => {
    if (id) {
      const updated = await updateTodo(id, input);
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } else {
      const created = await addTodo(input);
      setTodos((prev) => [created, ...prev]);
    }
    setSheet({ open: false, todo: null });
    setError('');
  };

  const handleToggle = async (t: Todo) => {
    const next = t.status === 'done' ? 'todo' : 'done';
    setTodos((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next, done: next === 'done' } : x)));
    try {
      const updated = await updateTodo(t.id, { status: next });
      setTodos((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch {
      setTodos((prev) => prev.map((x) => (x.id === t.id ? t : x)));
      setError('Failed to update task');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    setSheet({ open: false, todo: null });
  };

  const renderBody = () => {
    if (view === 'all') {
      return SECTION_META.map((s) => (
        <TaskSection
          key={s.key}
          label={s.label}
          icon={s.icon}
          todos={buckets[s.key]}
          onOpen={(t) => setSheet({ open: true, todo: t })}
          onToggle={handleToggle}
        />
      ));
    }
    const list =
      view === 'today' ? buckets.today :
      view === 'upcoming' ? buckets.upcoming :
      view === 'overdue' ? buckets.overdue :
      buckets.done;
    if (list.length === 0) {
      return (
        <div className="empty-state">
          <span className="empty-icon">🗒️</span>
          <p className="empty-desc">No tasks in this view.</p>
        </div>
      );
    }
    return (
      <ul className="task-list">
        <AnimatePresence initial={false}>
          {sortTodos(list).map((t) => (
            <TaskCard key={t.id} todo={t} onOpen={() => setSheet({ open: true, todo: t })} onToggle={() => handleToggle(t)} />
          ))}
        </AnimatePresence>
      </ul>
    );
  };

  if (loading) {
    return (
      <div className="plans">
        <h2 className="section-title">🗒️ Plans & Todos</h2>
        <div className="stat-cards">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton skeleton-text" style={{ width: 50, height: 10, marginBottom: 12 }} />
              <div className="skeleton skeleton-text" style={{ width: 70, height: 24 }} />
            </div>
          ))}
        </div>
        <div className="skeleton-card" style={{ minHeight: 160 }}>
          <div className="skeleton skeleton-text" style={{ width: 120, height: 14, marginBottom: 16 }} />
          <div className="skeleton skeleton-text" style={{ width: '100%', height: 44, borderRadius: 10, marginBottom: 10 }} />
          <div className="skeleton skeleton-text" style={{ width: '90%', height: 44, borderRadius: 10 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <span className="empty-icon">⚠️</span>
        <p className="empty-title">Something went wrong</p>
        <p className="empty-desc">{error}</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={load}>Try Again</button>
      </div>
    );
  }

  return (
    <motion.div className="plans" variants={container} initial="hidden" animate="show">
      <motion.div className="plans-header" variants={item}>
        <h2 className="section-title">🗒️ Plans & Todos</h2>
        <button className="btn primary" onClick={() => setSheet({ open: true, todo: null })}>+ Add Task</button>
      </motion.div>

      <motion.div className="task-summary" variants={item}>
        {([
          ['today', '☀️', 'Today'],
          ['upcoming', '📅', 'Upcoming'],
          ['overdue', '🔴', 'Overdue'],
          ['completed', '✅', 'Completed'],
        ] as const).map(([key, icon, label]) => (
          <button key={key} className="task-summary-tile" onClick={() => setView(key as View)}>
            <span className="tile-icon">{icon}</span>
            <span className="tile-value">{summary[key]}</span>
            <span className="tile-label">{label}</span>
          </button>
        ))}
      </motion.div>

      <motion.div className="view-pills" variants={item}>
        {VIEWS.map((v) => (
          <button
            key={v.value}
            className={`pill ${view === v.value ? 'active' : ''}`}
            onClick={() => setView(v.value)}
          >
            {v.label}
          </button>
        ))}
      </motion.div>

      <motion.div variants={item}>{renderBody()}</motion.div>

      <TaskSheet
        open={sheet.open}
        todo={sheet.todo}
        onClose={() => setSheet({ open: false, todo: null })}
        onSave={handleSave}
        onDelete={sheet.todo ? handleDelete : undefined}
      />
    </motion.div>
  );
}
