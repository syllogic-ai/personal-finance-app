'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, TrendingDown, TrendingUp, CreditCard, Filter, X } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getCategories, getMonthlyCashflow, getSankeyData, getAccounts, getAccountBalances } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { SankeyChart } from '@/components/charts/SankeyChart';
import type { Category, AnalyticsFilters, Account } from '@/types';

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${
          trend === 'up' ? 'bg-green-100 text-green-600' :
          trend === 'down' ? 'bg-red-100 text-red-600' :
          'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
        }`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function FiltersSection({
  filters,
  setFilters,
  categories,
  accounts,
}: {
  filters: AnalyticsFilters;
  setFilters: (filters: AnalyticsFilters) => void;
  categories: Category[];
  accounts: Account[];
}) {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filters.from || filters.to || filters.category_id || filters.account_id || filters.uncategorized;

  const clearFilters = () => {
    setFilters({});
  };

  const handleCategoryChange = (value: string) => {
    if (value === 'uncategorized') {
      setFilters({
        ...filters,
        category_id: undefined,
        uncategorized: true,
      });
    } else {
      setFilters({
        ...filters,
        category_id: value || undefined,
        uncategorized: undefined,
      });
    }
  };

  const setDatePreset = (preset: string) => {
    const now = new Date();
    let from: Date;
    const to = now;

    switch (preset) {
      case '1M':
        from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case '3M':
        from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6M':
        from = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case '1Y':
        from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'YTD':
        from = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return;
    }

    setFilters({
      ...filters,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick:</span>
          {['1M', '3M', '6M', '1Y', 'YTD'].map((preset) => (
            <button
              key={preset}
              onClick={() => setDatePreset(preset)}
              className="px-3 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="flex-1" />

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

      {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.from ? filters.from.split('T')[0] : ''}
              onChange={(e) => setFilters({
                ...filters,
                from: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })}
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
              onChange={(e) => setFilters({
                ...filters,
                to: e.target.value ? new Date(e.target.value).toISOString() : undefined,
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account
            </label>
            <select
              value={filters.account_id || ''}
              onChange={(e) => setFilters({
                ...filters,
                account_id: e.target.value || undefined,
              })}
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
              Category (Bar Chart only)
            </label>
            <select
              value={filters.category_id || (filters.uncategorized ? 'uncategorized' : '')}
              onChange={(e) => handleCategoryChange(e.target.value)}
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
        </div>
      )}
    </div>
  );
}

// Sankey diagram showing income -> cash flow -> expenses
function IncomeExpenseFlow({ filters }: { filters: AnalyticsFilters }) {
  const { data: sankeyData, isLoading, error } = useQuery({
    queryKey: ['sankey', filters.from, filters.to, filters.account_id, filters.uncategorized],
    queryFn: () => getSankeyData(filters),
  });

  // Transform backend data to SankeyChart props
  const chartData = useMemo(() => {
    if (!sankeyData) return null;

    const incomes: { name: string; value: number }[] = [];
    const expenses: { name: string; value: number }[] = [];

    // Find Total Income node index
    const totalIncomeIndex = sankeyData.nodes.findIndex(n => n.name === 'Total Income');

    // Extract income sources (nodes with "Income:" prefix)
    sankeyData.links.forEach((link) => {
      const sourceNode = sankeyData.nodes[link.source];
      const targetNode = sankeyData.nodes[link.target];

      // Income sources link TO "Total Income"
      if (link.target === totalIncomeIndex && sourceNode.name.startsWith('Income:')) {
        incomes.push({
          name: sourceNode.name.replace('Income: ', ''),
          value: link.value,
        });
      }

      // Expenses link FROM "Total Income" (excluding Savings which is handled separately)
      if (link.source === totalIncomeIndex && targetNode.name !== 'Savings') {
        expenses.push({
          name: targetNode.name,
          value: link.value,
        });
      }
    });

    return { incomes, expenses };
  }, [sankeyData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-80 text-red-500">
        Error loading data. Make sure the backend is running.
      </div>
    );
  }

  if (!sankeyData || !chartData || sankeyData.totalIncome === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-gray-500">
        No data available for the selected period
      </div>
    );
  }

  return (
    <SankeyChart
      incomes={chartData.incomes}
      expenses={chartData.expenses}
      totalIncome={sankeyData.totalIncome}
      totalExpenses={sankeyData.totalExpenses}
      savings={sankeyData.savings}
    />
  );
}

function MonthlyCashflowChart({ filters }: { filters: AnalyticsFilters }) {
  const { data: cashflowData, isLoading, error } = useQuery({
    queryKey: ['monthly-cashflow', filters.from, filters.to, filters.category_id, filters.account_id, filters.uncategorized],
    queryFn: () => getMonthlyCashflow(filters),
  });

  const chartData = useMemo(() => {
    if (!cashflowData) return [];
    return cashflowData.map((item) => ({
      ...item,
      monthLabel: new Date(item.month + '-01').toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      }),
    }));
  }, [cashflowData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-80 text-red-500">
        Error loading data. Make sure the backend is running.
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-gray-500">
        No data available for the selected period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="monthLabel"
          tick={{ fill: '#6B7280', fontSize: 12 }}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          tick={{ fill: '#6B7280', fontSize: 12 }}
          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatCurrency(value),
            name === 'income' ? 'Income' : 'Expenses',
          ]}
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <Bar dataKey="income" name="Income" fill="#22C55E" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AccountBalancePieChart({ filters }: { filters: AnalyticsFilters }) {
  const { data: accountBalances = [], isLoading } = useQuery({
    queryKey: ['account-balances', filters.from, filters.to, filters.account_id, filters.category_id, filters.uncategorized],
    queryFn: () => getAccountBalances(filters),
  });

  const chartData = useMemo(() => {
    return accountBalances
      .filter(account => account.balance !== 0)
      .map(account => ({
        name: account.name,
        value: Math.abs(account.balance),
        balance: account.balance,
        currency: account.currency,
      }))
      .sort((a, b) => b.value - a.value);
  }, [accountBalances]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  const COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6'
  ];

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-gray-500">
        No account data available
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8">
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string, props: any) => {
              const account = props.payload;
              if (!account || account.balance === undefined) {
                return formatCurrency(value, 'EUR');
              }
              return formatCurrency(account.balance, account.currency);
            }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="flex-1">
        <div className="space-y-3">
          {chartData.map((account, index) => (
            <div key={account.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {account.name}
                </span>
              </div>
              <span className={`text-sm font-semibold ${
                account.balance < 0 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-900 dark:text-white'
              }`}>
                {formatCurrency(account.balance, account.currency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({});

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  // Fetch period-based metrics that respond to filters
  const { data: sankeyData, isLoading: metricsLoading } = useQuery({
    queryKey: ['sankey-metrics', filters.from, filters.to, filters.account_id, filters.uncategorized],
    queryFn: () => getSankeyData(filters),
  });
  
  // Fetch accounts for pie chart
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const totalIncome = sankeyData?.totalIncome ?? 0;
  const totalExpenses = sankeyData?.totalExpenses ?? 0;
  const netSavings = sankeyData?.savings ?? 0;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Format the period label for display
  const periodLabel = useMemo(() => {
    if (!filters.from && !filters.to) return 'All Time';
    const from = filters.from ? new Date(filters.from).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
    const to = filters.to ? new Date(filters.to).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
    if (from && to) return `${from} - ${to}`;
    if (from) return `From ${from}`;
    if (to) return `Until ${to}`;
    return 'All Time';
  }, [filters.from, filters.to]);

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Overview of your finances {filters.from || filters.to ? `(${periodLabel})` : ''}
        </p>
      </div>

      {/* Metric Cards - Period Based */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Income"
          value={formatCurrency(totalIncome)}
          icon={TrendingUp}
          trend="up"
        />
        <MetricCard
          title="Total Expenses"
          value={formatCurrency(totalExpenses)}
          icon={TrendingDown}
          trend="down"
        />
        <MetricCard
          title="Net Savings"
          value={formatCurrency(netSavings)}
          icon={Wallet}
          trend={netSavings >= 0 ? 'up' : 'down'}
        />
        <MetricCard
          title="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          icon={CreditCard}
          trend={savingsRate >= 20 ? 'up' : savingsRate >= 0 ? undefined : 'down'}
        />
      </div>

      {/* Filters */}
      <FiltersSection
        filters={filters}
        setFilters={setFilters}
        categories={categories}
        accounts={accounts}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Income to Expense Flow */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Income to Expenses Flow
          </h2>
          <IncomeExpenseFlow filters={filters} />
        </div>

        {/* Monthly Bar Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Monthly Income vs Expenses
          </h2>
          <MonthlyCashflowChart filters={filters} />
        </div>
      </div>

      {/* Account Balance Pie Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Balance per Account
        </h2>
        <AccountBalancePieChart filters={filters} />
      </div>
    </div>
  );
}
