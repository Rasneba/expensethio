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
  due_date: string | null;
  creditor: string;
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
  incomeTotal: number;
  expenseTotal: number;
  creditBorrowed: number;
  creditPayments: number;
  creditOwed: number;
  availableBalance: number;
  monthIncome: number;
  monthExpense: number;
  monthBalance: number;
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

export const updateCredit = async (
  id: string,
  updates: Partial<Credit>
): Promise<Credit> => {
  const res = await api.put<Credit>(`/credits/${id}`, updates);
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

export type ReportPeriod = 'all' | 'week' | 'month' | 'year';

export interface Budget {
  id: string;
  category: string;
  amount: number;
  month: string;
  created_at?: string;
  actual?: number;
  percentage?: number;
}

export type ReportBreakdown = {
  category: string;
  total: number;
  count?: number;
};

export interface ReportsData {
  overview: {
    income: number;
    expense: number;
    borrowed: number;
    creditPaid: number;
    creditOwed: number;
    availableBalance: number;
  };
  expense: {
    total: number;
    count: number;
    average: number;
    largest: number;
    byCategory: ReportBreakdown[];
    byMethod: Array<{ method: string; total: number; count: number }>;
    transactions: Expense[];
  };
  income: {
    total: number;
    count: number;
    bySource: Array<{ source: string; total: number; count: number }>;
    transactions: Expense[];
  };
  credit: {
    borrowed: number;
    paid: number;
    outstanding: number;
    overdueAmount: number;
    overdueCount: number;
    dueSoonCount: number;
    history: Credit[];
  };
  monthly: {
    month: string;
    income: number;
    expense: number;
    creditPayments: number;
    remaining: number;
    byCategory: ReportBreakdown[];
    budgets: Budget[];
  };
  budgets: Budget[];
}

export interface ReportFilters {
  period?: ReportPeriod;
  from?: string;
  to?: string;
  category?: string;
  method?: TxMethod | '';
  month?: string;
}

export const getReports = async (filters: ReportFilters = {}): Promise<ReportsData> => {
  const res = await api.get<ReportsData>('/reports', { params: filters });
  return res.data;
};

export const getBudgets = async (month?: string): Promise<Budget[]> => {
  const res = await api.get<Budget[]>('/budgets', { params: { month } });
  return res.data;
};

export const saveBudget = async (budget: Pick<Budget, 'category' | 'amount' | 'month'>): Promise<Budget> => {
  const res = await api.post<Budget>('/budgets', budget);
  return res.data;
};

export const deleteBudget = async (id: string): Promise<void> => {
  await api.delete(`/budgets/${id}`);
};
