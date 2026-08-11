import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export type TxType = 'expense' | 'income';
export type TxMethod = 'cash' | 'mobile';

export interface Expense {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  description: string;
  date: string;
  method: TxMethod;
  created_at: string;
}

export type CreditType = 'borrow' | 'payment';

export interface Credit {
  id: string;
  type: CreditType;
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface MonthPoint {
  month: string;
  expense: number;
  income: number;
}

export interface DashboardData {
  expenseTotal: number;
  incomeTotal: number;
  balance: number;
  monthExpense: number;
  monthIncome: number;
  monthBalance: number;
  creditTotal: number;
  count: number;
  byCategory: CategoryTotal[];
  byMonth: MonthPoint[];
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const getExpenses = async (from?: string, to?: string): Promise<Expense[]> => {
  const res = await api.get<Expense[]>('/expenses', {
    params: { from: from || undefined, to: to || undefined },
  });
  return res.data;
};

export const addExpense = async (
  expense: Omit<Expense, 'id' | 'created_at'>
): Promise<Expense> => {
  const res = await api.post<Expense>('/expenses', expense);
  return res.data;
};

export const updateExpense = async (
  id: string,
  updates: Partial<Expense>
): Promise<Expense> => {
  const res = await api.put<Expense>(`/expenses/${id}`, updates);
  return res.data;
};

export const deleteExpense = async (id: string): Promise<void> => {
  await api.delete(`/expenses/${id}`);
};

export const getCredits = async (): Promise<Credit[]> => {
  const res = await api.get<Credit[]>('/credits');
  return res.data;
};

export const addCredit = async (
  credit: Omit<Credit, 'id' | 'created_at'>
): Promise<Credit> => {
  const res = await api.post<Credit>('/credits', credit);
  return res.data;
};

export const deleteCredit = async (id: string): Promise<void> => {
  await api.delete(`/credits/${id}`);
};

export const getDashboard = async (): Promise<DashboardData> => {
  const res = await api.get<DashboardData>('/dashboard');
  return res.data;
};

export type Period = 'daily' | 'weekly' | 'monthly' | 'general';

export interface Todo {
  id: string;
  title: string;
  period: Period;
  done: boolean;
  created_at: string;
}

export const getTodos = async (): Promise<Todo[]> => {
  const res = await api.get<Todo[]>('/todos');
  return res.data;
};

export const addTodo = async (title: string, period: Period): Promise<Todo> => {
  const res = await api.post<Todo>('/todos', { title, period });
  return res.data;
};

export const updateTodo = async (
  id: string,
  updates: Partial<Pick<Todo, 'title' | 'done'>>
): Promise<Todo> => {
  const res = await api.put<Todo>(`/todos/${id}`, updates);
  return res.data;
};

export const deleteTodo = async (id: string): Promise<void> => {
  await api.delete(`/todos/${id}`);
};
