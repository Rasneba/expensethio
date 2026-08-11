import { Todo, TodoPriority, TodoRepeat, TodoStatus } from '../services/api';

export type Bucket = 'today' | 'upcoming' | 'overdue' | 'none';

export function classifyTodo(t: Todo): Bucket {
  if (t.status === 'done' || !t.due_at) return 'none';
  const due = new Date(t.due_at).getTime();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 86400000 - 1;
  if (due < start) return 'overdue';
  if (due <= end) return 'today';
  return 'upcoming';
}

export function formatDue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(d) - startOf(now)) / 86400000);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let date: string;
  if (dayDiff === 0) date = 'Today';
  else if (dayDiff === 1) date = 'Tomorrow';
  else if (dayDiff === -1) date = 'Yesterday';
  else date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${date} • ${time}`;
}

export const CATEGORIES = ['Work', 'Personal', 'Finance', 'Maintenance', 'Calls', 'Shopping', 'Other'];

export const PRIORITY_META: Record<TodoPriority, { label: string; dot: string }> = {
  high: { label: 'High', dot: '🔴' },
  medium: { label: 'Medium', dot: '🟡' },
  low: { label: 'Low', dot: '🟢' },
};

export const STATUS_META: Record<TodoStatus, { label: string; icon: string }> = {
  todo: { label: 'Not started', icon: '○' },
  in_progress: { label: 'In progress', icon: '◐' },
  done: { label: 'Done', icon: '●' },
};

export const REMINDER_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'None', value: null },
  { label: '5 minutes before', value: 5 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '12 hours before', value: 720 },
  { label: '1 day before', value: 1440 },
];

export const REPEAT_OPTIONS: { label: string; value: TodoRepeat }[] = [
  { label: 'None', value: 'none' },
  { label: 'Every day', value: 'daily' },
  { label: 'Every weekday', value: 'weekday' },
  { label: 'Every week', value: 'weekly' },
  { label: 'Every month', value: 'monthly' },
  { label: 'Custom...', value: 'custom' },
];

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

export function sortTodos(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    const da = a.due_at ? new Date(a.due_at).getTime() : Infinity;
    const db = b.due_at ? new Date(b.due_at).getTime() : Infinity;
    if (da !== db) return da - db;
    const pa = PRIORITY_ORDER[a.priority];
    const pb = PRIORITY_ORDER[b.priority];
    if (pa !== pb) return pa - pb;
    return String(a.title).localeCompare(String(b.title));
  });
}
