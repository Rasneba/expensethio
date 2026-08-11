import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Todo, TodoInput, TodoPriority, TodoRepeat, TodoStatus } from '../services/api';
import {
  CATEGORIES,
  REMINDER_OPTIONS,
  REPEAT_OPTIONS,
  fromLocalInput,
  toLocalInput,
} from '../utils/tasks';

interface TaskSheetProps {
  open: boolean;
  todo: Todo | null;
  onClose: () => void;
  onSave: (input: TodoInput, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const STATUS_OPTIONS: { value: TodoStatus; label: string; icon: string }[] = [
  { value: 'todo', label: 'To Do', icon: '○' },
  { value: 'in_progress', label: 'In Progress', icon: '◐' },
  { value: 'done', label: 'Completed', icon: '●' },
];

export default function TaskSheet({ open, todo, onClose, onSave, onDelete }: TaskSheetProps) {
  const isNew = !todo;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TodoStatus>('todo');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueLocal, setDueLocal] = useState('');
  const [reminder, setReminder] = useState('');
  const [repeat, setRepeat] = useState<TodoRepeat>('none');
  const [repeatEvery, setRepeatEvery] = useState('1');
  const [repeatUnit, setRepeatUnit] = useState<'day' | 'week' | 'month'>('day');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(todo?.title ?? '');
    setDescription(todo?.description ?? '');
    setStatus(todo?.status ?? 'todo');
    setPriority(todo?.priority ?? 'medium');
    setDueLocal(todo?.due_at ? toLocalInput(todo.due_at) : '');
    setReminder(todo?.reminder_minutes != null ? String(todo.reminder_minutes) : '');
    setRepeat(todo?.repeat ?? 'none');
    setRepeatEvery(String(todo?.repeat_every ?? 1));
    setRepeatUnit((todo?.repeat_unit as 'day' | 'week' | 'month') ?? 'day');
    setCategory(todo?.category ?? '');
    setNotes(todo?.notes ?? '');
    setFormError('');
    setSaving(false);
  }, [open, todo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const reminderOptions = useMemo(() => {
    if (reminder && !REMINDER_OPTIONS.some((o) => o.value != null && String(o.value) === reminder)) {
      return [{ label: `${reminder} minutes before`, value: reminder }, ...REMINDER_OPTIONS];
    }
    return REMINDER_OPTIONS;
  }, [reminder]);

  const categoryOptions = useMemo(() => {
    const list = [...CATEGORIES];
    if (category && !list.includes(category)) list.unshift(category);
    return list;
  }, [category]);

  const save = async () => {
    if (!title.trim()) {
      setFormError('Title is required');
      return;
    }
    setSaving(true);
    setFormError('');
    const input: TodoInput = {
      title: title.trim(),
      description,
      status,
      priority,
      due_at: fromLocalInput(dueLocal),
      reminder_minutes: reminder === '' ? null : Number(reminder),
      repeat,
      repeat_every: repeat === 'custom' && repeatEvery ? Math.max(1, Number(repeatEvery) || 1) : null,
      repeat_unit: repeat === 'custom' ? repeatUnit : null,
      category,
      notes,
    };
    try {
      await onSave(input, todo?.id);
    } catch {
      setFormError('Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!todo || !onDelete) return;
    if (!window.confirm('Delete this task?')) return;
    setSaving(true);
    try {
      await onDelete(todo.id);
    } catch {
      setFormError('Failed to delete task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-overlay"
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="sheet"
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <h3>{isNew ? 'New Task' : 'Task Details'}</h3>
              <button className="btn icon" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className="sheet-body">
              <label className="field">
                <span>Title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details..."
                  rows={2}
                />
              </label>

              <div className="field">
                <span>Status</span>
                <div className="segmented">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      className={`seg ${status === s.value ? 'active' : ''}`}
                      onClick={() => setStatus(s.value)}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Priority</span>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as TodoPriority)}>
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </label>

                <label className="field">
                  <span>Category</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">None</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Due date & time</span>
                  <input
                    type="datetime-local"
                    value={dueLocal}
                    onChange={(e) => setDueLocal(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Reminder</span>
                  <select value={reminder} onChange={(e) => setReminder(e.target.value)}>
                    {reminderOptions.map((o) => (
                      <option key={String(o.value)} value={o.value != null ? String(o.value) : ''}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field">
                <span>Repeat</span>
                <div className="field-row">
                  <select value={repeat} onChange={(e) => setRepeat(e.target.value as TodoRepeat)}>
                    {REPEAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {repeat === 'custom' && (
                    <>
                      <input
                        type="number"
                        min={1}
                        value={repeatEvery}
                        onChange={(e) => setRepeatEvery(e.target.value)}
                        style={{ width: 70 }}
                        aria-label="Every"
                      />
                      <select value={repeatUnit} onChange={(e) => setRepeatUnit(e.target.value as 'day' | 'week' | 'month')}>
                        <option value="day">days</option>
                        <option value="week">weeks</option>
                        <option value="month">months</option>
                      </select>
                    </>
                  )}
                </div>
              </div>

              <label className="field">
                <span>Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Extra notes..."
                  rows={2}
                />
              </label>

              {formError && <p className="form-error">{formError}</p>}
            </div>

            <div className="sheet-footer">
              {!isNew && onDelete && (
                <button className="btn danger" onClick={del} disabled={saving}>Delete</button>
              )}
              <div className="spacer" />
              <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
