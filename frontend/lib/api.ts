import axios from 'axios';
import type { Account, Category, Transaction, CategorySpending, TransactionFilters, MonthlyCashflow, SankeyData, AnalyticsFilters } from '@/types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Accounts
export const getAccounts = async (includeInactive: boolean = true): Promise<Account[]> => {
  const params = new URLSearchParams();
  // FastAPI boolean query params: 'true'/'false' as strings, or omit for default
  // Since default is True in backend, we only need to send if it's False
  if (!includeInactive) {
    params.append('include_inactive', 'false');
  }
  // If includeInactive is true, don't send the param (use backend default of True)
  const url = params.toString() ? `/accounts?${params.toString()}` : '/accounts';
  const { data } = await api.get(url);
  return data;
};

export const getAccount = async (id: string): Promise<Account> => {
  const { data } = await api.get(`/accounts/${id}`);
  return data;
};

export const deleteRevolutDefaultAccounts = async (): Promise<{ message: string; deleted_count: number }> => {
  const { data } = await api.delete('/accounts/cleanup/revolut-default');
  return data;
};

export const restoreSeedAccounts = async (): Promise<{ message: string; created_count: number }> => {
  const { data } = await api.post('/accounts/restore-seed');
  return data;
};

export const recalculateAccountBalance = async (accountId: string): Promise<{ message: string; account_id: string; account_name: string; new_balance: number; currency: string }> => {
  const { data } = await api.post(`/accounts/${accountId}/recalculate-balance`);
  return data;
};

export const deleteEmptyAccounts = async (): Promise<{ message: string; deleted_count: number; deleted_accounts: string[] }> => {
  const { data } = await api.delete('/accounts/cleanup/empty-accounts');
  return data;
};

export interface AccountDebugInfo {
  id: string;
  name: string;
  account_type: string;
  institution: string | null;
  currency: string;
  provider: string | null;
  external_id: string | null;
  balance_current: number;
  balance_available: number | null;
  is_active: boolean;
  transaction_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export const getAllAccountsDebug = async (): Promise<{ total_accounts: number; accounts: AccountDebugInfo[] }> => {
  const { data } = await api.get('/accounts/debug/all');
  return data;
};

// Categories
export const getCategories = async (): Promise<Category[]> => {
  const { data } = await api.get('/categories');
  return data;
};

export const createCategory = async (category: Partial<Category>): Promise<Category> => {
  const { data } = await api.post('/categories', category);
  return data;
};

export const updateCategory = async (id: string, updates: Partial<Category>): Promise<Category> => {
  const { data } = await api.patch(`/categories/${id}`, updates);
  return data;
};

export const deleteCategory = async (id: string): Promise<void> => {
  await api.delete(`/categories/${id}`);
};

// Transactions
export const getTransactions = async (filters: TransactionFilters = {}): Promise<Transaction[]> => {
  const params = new URLSearchParams();

  if (filters.account_id) params.append('account_id', filters.account_id);
  if (filters.category_id) params.append('category_id', filters.category_id);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.search) params.append('search', filters.search);
  if (filters.uncategorized) params.append('uncategorized', 'true');
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.sort_by) params.append('sort_by', filters.sort_by);
  if (filters.sort_order) params.append('sort_order', filters.sort_order);
  if (filters.type) params.append('type', filters.type);

  const { data } = await api.get(`/transactions?${params.toString()}`);
  return data;
};

export const getTransaction = async (id: string): Promise<Transaction> => {
  const { data } = await api.get(`/transactions/${id}`);
  return data;
};

export const createTransaction = async (transaction: Partial<Transaction>): Promise<Transaction> => {
  const { data } = await api.post('/transactions', transaction);
  return data;
};

export const updateTransaction = async (id: string, updates: Partial<Transaction>): Promise<Transaction> => {
  const { data } = await api.patch(`/transactions/${id}`, updates);
  return data;
};

export const assignCategory = async (transactionId: string, categoryId: string): Promise<Transaction> => {
  const { data } = await api.patch(`/transactions/${transactionId}/category`, { category_id: categoryId });
  return data;
};

export const deleteTransaction = async (id: string): Promise<void> => {
  await api.delete(`/transactions/${id}`);
};

export const deleteTransactionsByAccount = async (accountId: string): Promise<{ message: string; deleted_count: number; account_name: string }> => {
  const { data } = await api.delete(`/transactions/by-account/${accountId}`);
  return data;
};

// Analytics
export const getSpendingByCategory = async (from?: string, to?: string): Promise<CategorySpending[]> => {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);

  const { data } = await api.get(`/transactions/stats/by-category?${params.toString()}`);
  return data;
};

export const getMonthlyCashflow = async (filters: AnalyticsFilters = {}): Promise<MonthlyCashflow[]> => {
  const params = new URLSearchParams();
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.category_id) params.append('category_id', filters.category_id);
  if (filters.account_id) params.append('account_id', filters.account_id);
  if (filters.uncategorized) params.append('uncategorized', 'true');

  const { data } = await api.get(`/analytics/cashflow/monthly?${params.toString()}`);
  return data;
};

export const getSankeyData = async (filters: AnalyticsFilters = {}): Promise<SankeyData> => {
  const params = new URLSearchParams();
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.account_id) params.append('account_id', filters.account_id);
  if (filters.uncategorized) params.append('uncategorized', 'true');

  const { data } = await api.get(`/analytics/sankey?${params.toString()}`);
  return data;
};

export interface AccountBalance {
  account_id: string;
  name: string;
  balance: number;
  currency: string;
  account_type: string;
}

export const getAccountBalances = async (filters: AnalyticsFilters = {}): Promise<AccountBalance[]> => {
  const params = new URLSearchParams();
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.account_id) params.append('account_id', filters.account_id);
  if (filters.category_id) params.append('category_id', filters.category_id);
  if (filters.uncategorized) params.append('uncategorized', 'true');

  const { data } = await api.get(`/analytics/account-balances?${params.toString()}`);
  return data;
};

// Sync
export interface SyncResponse {
  accounts_synced: number;
  transactions_created: number;
  transactions_updated: number;
  message: string;
}

export const syncRevolutCSV = async (file: File, startDate?: string, endDate?: string): Promise<SyncResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  const { data } = await api.post(`/sync/revolut/csv?${params.toString()}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};
