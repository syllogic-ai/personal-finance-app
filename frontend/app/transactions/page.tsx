'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, X, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { getTransactions, getCategories, getAccounts, assignCategory } from '@/lib/api';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';
import type { Transaction, Category, Account, TransactionFilters } from '@/types';

function CategorySelect({
  categories,
  value,
  onChange,
  placeholder = "Select category"
}: {
  categories: Category[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const expenseCategories = categories.filter(c => c.category_type === 'expense');
  const incomeCategories = categories.filter(c => c.category_type === 'income');
  const transferCategories = categories.filter(c => c.category_type === 'transfer');

  const selected = categories.find(c => c.id === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <span className={selected ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 uppercase">Expenses</p>
            </div>
            {expenseCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  onChange(cat.id);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                {cat.color && (
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                )}
                <span className="text-gray-900 dark:text-white">{cat.name}</span>
              </button>
            ))}
            <div className="p-2 border-y border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 uppercase">Income</p>
            </div>
            {incomeCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  onChange(cat.id);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                {cat.color && (
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                )}
                <span className="text-gray-900 dark:text-white">{cat.name}</span>
              </button>
            ))}
            {transferCategories.length > 0 && (
              <>
                <div className="p-2 border-y border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 uppercase">Transfers</p>
                </div>
                {transferCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      onChange(cat.id);
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    {cat.color && (
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <span className="text-gray-900 dark:text-white">{cat.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TransactionRow({
  transaction,
  categories,
  onCategoryChange,
}: {
  transaction: Transaction;
  categories: Category[];
  onCategoryChange: (transactionId: string, categoryId: string) => void;
}) {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="px-6 py-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {transaction.description}
          </p>
          <p className="text-sm text-gray-500">
            {transaction.merchant || 'No merchant'}
          </p>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        {transaction.account_name}
      </td>
      <td className="px-6 py-4">
        <div className="w-40">
          <CategorySelect
            categories={categories}
            value={transaction.category_id}
            onChange={(categoryId) => onCategoryChange(transaction.id, categoryId)}
            placeholder="Uncategorized"
          />
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        {formatDateTime(transaction.booked_at)}
      </td>
      <td className="px-6 py-4 text-right">
        <span className={cn(
          'text-sm font-semibold',
          transaction.amount < 0 ? 'text-red-600' : 'text-green-600'
        )}>
          {formatCurrency(transaction.amount)}
        </span>
      </td>
    </tr>
  );
}

type SortField = 'description' | 'account' | 'category' | 'date' | 'amount';

function SortableHeader({
  label,
  sortField,
  currentSort,
  currentOrder,
  onSort,
  align = 'left',
}: {
  label: string;
  sortField: SortField;
  currentSort?: SortField;
  currentOrder?: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  align?: 'left' | 'right';
}) {
  const isActive = currentSort === sortField;
  const Icon = isActive
    ? currentOrder === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th
      className={cn(
        'px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
        align === 'left' ? 'text-left' : 'text-right'
      )}
      onClick={() => onSort(sortField)}
    >
      <div className="flex items-center gap-2">
        <span>{label}</span>
        <Icon
          className={cn(
            'h-4 w-4',
            isActive
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400 dark:text-gray-500'
          )}
        />
      </div>
    </th>
  );
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>({
    limit: 50,
    sort_by: 'date',
    sort_order: 'desc',
  });
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleSort = (field: SortField) => {
    setFilters((prev) => {
      const newSortBy = field;
      const newSortOrder =
        prev.sort_by === field && prev.sort_order === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        sort_by: newSortBy,
        sort_order: newSortOrder,
      };
    });
  };

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => getTransactions(filters),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const assignCategoryMutation = useMutation({
    mutationFn: ({ transactionId, categoryId }: { transactionId: string; categoryId: string }) =>
      assignCategory(transactionId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['spending-by-category'] });
    },
  });

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput || undefined }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setFilters({ limit: 50, sort_by: 'date', sort_order: 'desc' });
    setSearchInput('');
  };

  const hasActiveFilters = filters.account_id || filters.category_id || filters.uncategorized || filters.search || filters.type;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {transactions.length} transactions
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500"
              />
            </div>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors',
              showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                !
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={filters.type || ''}
                onChange={(e) => setFilters((prev) => ({
                  ...prev,
                  type: (e.target.value as 'income' | 'expense' | '') || undefined,
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All transactions</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account
              </label>
              <select
                value={filters.account_id || ''}
                onChange={(e) => setFilters((prev) => ({
                  ...prev,
                  account_id: e.target.value || undefined,
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={filters.category_id || (filters.uncategorized ? 'uncategorized' : '')}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'uncategorized') {
                    setFilters((prev) => ({
                      ...prev,
                      category_id: undefined,
                      uncategorized: true,
                    }));
                  } else {
                    setFilters((prev) => ({
                      ...prev,
                      category_id: value || undefined,
                      uncategorized: undefined,
                    }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All categories</option>
                <option value="uncategorized">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={filters.from ? filters.from.split('T')[0] : ''}
                onChange={(e) => setFilters((prev) => ({
                  ...prev,
                  from: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={filters.to ? filters.to.split('T')[0] : ''}
                onChange={(e) => setFilters((prev) => ({
                  ...prev,
                  to: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Transaction Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        {transactionsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p>No transactions found</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <SortableHeader
                    label="Description"
                    sortField="description"
                    currentSort={filters.sort_by}
                    currentOrder={filters.sort_order}
                    onSort={handleSort}
                    align="left"
                  />
                  <SortableHeader
                    label="Account"
                    sortField="account"
                    currentSort={filters.sort_by}
                    currentOrder={filters.sort_order}
                    onSort={handleSort}
                    align="left"
                  />
                  <SortableHeader
                    label="Category"
                    sortField="category"
                    currentSort={filters.sort_by}
                    currentOrder={filters.sort_order}
                    onSort={handleSort}
                    align="left"
                  />
                  <SortableHeader
                    label="Date"
                    sortField="date"
                    currentSort={filters.sort_by}
                    currentOrder={filters.sort_order}
                    onSort={handleSort}
                    align="left"
                  />
                  <SortableHeader
                    label="Amount"
                    sortField="amount"
                    currentSort={filters.sort_by}
                    currentOrder={filters.sort_order}
                    onSort={handleSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {transactions.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    transaction={txn}
                    categories={categories}
                    onCategoryChange={(transactionId, categoryId) =>
                      assignCategoryMutation.mutate({ transactionId, categoryId })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
