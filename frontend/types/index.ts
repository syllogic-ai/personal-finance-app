export interface Account {
  id: string;
  name: string;
  account_type: string;
  institution: string | null;
  currency: string;
  balance_current: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  provider?: string | null;
  external_id?: string | null;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  category_type: 'expense' | 'income' | 'transfer';
  color: string | null;
  icon: string | null;
  is_system: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  external_id: string | null;
  transaction_type: 'debit' | 'credit';
  amount: number;
  currency: string;
  description: string;
  merchant: string | null;
  category_id: string | null;
  booked_at: string;
  pending: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  account_name: string;
}

export interface CategorySpending {
  category_id: string | null;
  category_name: string;
  total: number;
  count: number;
}

export interface TransactionFilters {
  account_id?: string;
  category_id?: string;
  from?: string;
  to?: string;
  search?: string;
  uncategorized?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'description' | 'account' | 'category' | 'date' | 'amount';
  sort_order?: 'asc' | 'desc';
  type?: 'income' | 'expense';
}

export interface MonthlyCashflow {
  month: string;
  income: number;
  expenses: number;
}

export interface SankeyNode {
  name: string;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalIncome: number;
  totalExpenses: number;
  savings: number;
}

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  category_id?: string;
  account_id?: string;
  uncategorized?: boolean;
}
