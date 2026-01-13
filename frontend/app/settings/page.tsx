'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Building2, CreditCard, PiggyBank, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { getAccounts, syncRevolutCSV, deleteRevolutDefaultAccounts, restoreSeedAccounts, deleteTransactionsByAccount, getAllAccountsDebug, recalculateAccountBalance, deleteEmptyAccounts } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { Account } from '@/types';

const accountTypeIcons: Record<string, React.ElementType> = {
  checking: CreditCard,
  savings: PiggyBank,
  credit: CreditCard,
  investment: Building2,
};

function AccountCard({ 
  account, 
  onDeleteTransactions,
  onRecalculateBalance
}: { 
  account: Account;
  onDeleteTransactions?: (accountId: string, accountName: string) => void;
  onRecalculateBalance?: (accountId: string, accountName: string) => void;
}) {
  const Icon = accountTypeIcons[account.account_type] || Wallet;
  
  // Show delete button for any account that has transactions (not just seed accounts)
  // This allows users to clean up transactions from any account
  const hasTransactions = account.balance_current !== 0 || account.provider === 'revolut';

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border p-6 ${
      !account.is_active 
        ? 'border-gray-300 dark:border-gray-700 opacity-60' 
        : 'border-gray-200 dark:border-gray-800'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {account.name}
              </h3>
              {!account.is_active && (
                <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {account.institution || 'Manual'} &middot; {account.account_type}
              {account.provider && ` &middot; ${account.provider}`}
              {account.external_id && ` &middot; ID: ${account.external_id}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={`text-lg font-semibold ${
              Number(account.balance_current) < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'
            }`}>
              {formatCurrency(Number(account.balance_current), account.currency)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Current balance
            </p>
          </div>
          <div className="flex gap-2">
            {onRecalculateBalance && (
              <button
                onClick={() => onRecalculateBalance(account.id, account.name)}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                title="Recalculate balance from transactions"
              >
                Recalculate
              </button>
            )}
            {onDeleteTransactions && (
              <button
                onClick={() => onDeleteTransactions(account.id, account.name)}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                title="Delete all transactions from this account"
              >
                Delete Transactions
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(true); // Show all accounts by default
  
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', includeInactive],
    queryFn: () => getAccounts(includeInactive),
  });

  const { data: debugAccounts } = useQuery({
    queryKey: ['accounts-debug'],
    queryFn: getAllAccountsDebug,
    enabled: showDebugInfo,
  });

  const deleteDefaultMutation = useMutation({
    mutationFn: deleteRevolutDefaultAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const restoreSeedMutation = useMutation({
    mutationFn: restoreSeedAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const handleDeleteRevolutDefault = () => {
    if (confirm('Are you sure you want to permanently delete all "Revolut default" accounts? This cannot be undone.')) {
      deleteDefaultMutation.mutate();
    }
  };

  const handleRestoreSeedAccounts = () => {
    restoreSeedMutation.mutate();
  };

  const deleteTransactionsMutation = useMutation({
    mutationFn: (accountId: string) => deleteTransactionsByAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const handleDeleteTransactions = (accountId: string, accountName: string) => {
    if (confirm(`Are you sure you want to permanently delete ALL transactions from "${accountName}"? This cannot be undone.`)) {
      deleteTransactionsMutation.mutate(accountId);
    }
  };

  const recalculateBalanceMutation = useMutation({
    mutationFn: (accountId: string) => recalculateAccountBalance(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const handleRecalculateBalance = (accountId: string, accountName: string) => {
    recalculateBalanceMutation.mutate(accountId);
  };

  const deleteEmptyAccountsMutation = useMutation({
    mutationFn: deleteEmptyAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  // Recalculate balances for all accounts every time Settings page is displayed
  useEffect(() => {
    if (!isLoading && accounts.length > 0) {
      // Recalculate balance for each account
      const accountIds = accounts.map(a => a.id);
      accountIds.forEach((accountId) => {
        recalculateAccountBalance(accountId).catch((error) => {
          console.error(`Error recalculating balance:`, error);
        });
      });
      // Invalidate queries after a short delay to allow all recalculations to complete
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
      }, 1000);
    }
  }, [isLoading]); // Run when loading completes

  // Automatically delete empty accounts every time Settings page is displayed
  useEffect(() => {
    if (!isLoading && accounts.length > 0) {
      deleteEmptyAccountsMutation.mutate();
    }
  }, [isLoading]); // Run when loading completes

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your accounts and preferences
        </p>
      </div>

      {/* Accounts Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Connected Accounts
            </h2>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show inactive accounts
            </label>
          </div>
          <div className="flex gap-2">
            {accounts.some(acc => acc.external_id === 'revolut_default') && (
              <button
                onClick={handleDeleteRevolutDefault}
                disabled={deleteDefaultMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteDefaultMutation.isPending ? 'Deleting...' : 'Delete Revolut Default'}
              </button>
            )}
            <button
              onClick={handleRestoreSeedAccounts}
              disabled={restoreSeedMutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {restoreSeedMutation.isPending ? 'Restoring...' : 'Restore Seed Accounts'}
            </button>
            <button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
            >
              {showDebugInfo ? 'Hide' : 'Show'} Debug Info
            </button>
          </div>
        </div>

        {/* Debug Info Section */}
        {showDebugInfo && debugAccounts && (
          <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Database Accounts (Debug) - Total: {debugAccounts.total_accounts}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">External ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Transactions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {debugAccounts.accounts.map((account) => (
                    <tr key={account.id} className={!account.is_active ? 'opacity-50' : ''}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {account.account_type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {account.provider || 'None'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">
                        {account.external_id || 'None'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatCurrency(account.balance_current, account.currency)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          account.is_active 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {account.is_active ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {account.transaction_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
            <Wallet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No accounts yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Run the seed script to add sample accounts.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <AccountCard 
                key={account.id} 
                account={account}
                onDeleteTransactions={handleDeleteTransactions}
                onRecalculateBalance={handleRecalculateBalance}
              />
            ))}
          </div>
        )}
        
        {deleteTransactionsMutation.isSuccess && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {deleteTransactionsMutation.data?.message}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {recalculateBalanceMutation.isSuccess && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {recalculateBalanceMutation.data?.message}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  New balance: {formatCurrency(recalculateBalanceMutation.data?.new_balance || 0, recalculateBalanceMutation.data?.currency || 'EUR')}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {deleteEmptyAccountsMutation.isSuccess && deleteEmptyAccountsMutation.data?.deleted_count > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {deleteEmptyAccountsMutation.data?.message}
                </p>
                {deleteEmptyAccountsMutation.data?.deleted_accounts && deleteEmptyAccountsMutation.data.deleted_accounts.length > 0 && (
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Deleted: {deleteEmptyAccountsMutation.data.deleted_accounts.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {deleteTransactionsMutation.isError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Failed to delete transactions
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {deleteTransactionsMutation.error instanceof Error
                    ? deleteTransactionsMutation.error.message
                    : 'An error occurred'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Revolut Import Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Import Revolut Transactions
        </h2>
        <RevolutImportSection />
      </div>

      {/* API Status */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          API Status
        </h2>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-gray-900 dark:text-white font-medium">Connected</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Backend API is running at http://localhost:8000
          </p>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 text-blue-600 hover:underline text-sm"
          >
            View API Documentation
          </a>
        </div>
      </div>
    </div>
  );
}

function RevolutImportSection() {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const syncMutation = useMutation({
    mutationFn: (file: File) => syncRevolutCSV(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setSelectedFile(null);
    },
  });

  const handleFileSelect = (file: File) => {
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      setSelectedFile(file);
    } else {
      alert('Please select a CSV file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      syncMutation.mutate(selectedFile);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Export your Revolut transactions as a CSV file from the Revolut app or web interface, then upload it here to import your transactions.
          </p>
          
          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            )}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-sm text-red-600 hover:underline mt-2"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Drag and drop your CSV file here, or
                </p>
                <label className="inline-block">
                  <span className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                    browse to select
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Upload Button */}
        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={syncMutation.isPending}
            className={cn(
              'w-full px-4 py-2 rounded-lg font-medium transition-colors',
              syncMutation.isPending
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            )}
          >
            {syncMutation.isPending ? 'Importing...' : 'Import Transactions'}
          </button>
        )}

        {/* Success/Error Messages */}
        {syncMutation.isSuccess && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Import successful!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  {syncMutation.data.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {syncMutation.isError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Import failed
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {syncMutation.error instanceof Error
                    ? syncMutation.error.message
                    : 'An error occurred while importing the file'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
