import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
}

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface DashboardData {
  total: number;
  monthTotal: number;
  count: number;
  byCategory: CategoryTotal[];
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const getExpenses = async (): Promise<Expense[]> => {
  const res = await api.get<Expense[]>('/expenses');
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

export const getDashboard = async (): Promise<DashboardData> => {
  const res = await api.get<DashboardData>('/dashboard');
  return res.data;
};