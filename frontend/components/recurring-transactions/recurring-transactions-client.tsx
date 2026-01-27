"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RecurringTransactionsTable } from "./recurring-transactions-table";
import { RecurringTransactionFormDialog } from "./recurring-transaction-form-dialog";
import { toast } from "sonner";
import {
  deleteRecurringTransaction,
  toggleRecurringTransactionActive,
  matchTransactionsToRecurring,
} from "@/lib/actions/recurring-transactions";
import type { RecurringTransaction } from "@/lib/db/schema";

interface RecurringTransactionWithCategory extends RecurringTransaction {
  category?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface RecurringTransactionsClientProps {
  initialTransactions: RecurringTransactionWithCategory[];
  categories: Array<{ id: string; name: string; color: string | null }>;
}

export function RecurringTransactionsClient({
  initialTransactions,
  categories,
}: RecurringTransactionsClientProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<RecurringTransactionWithCategory | null>(null);

  const handleAdd = () => {
    setEditingTransaction(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (transaction: RecurringTransactionWithCategory) => {
    setEditingTransaction(transaction);
    setFormDialogOpen(true);
  };

  const handleDelete = async (transaction: RecurringTransactionWithCategory) => {
    const result = await deleteRecurringTransaction(transaction.id);

    if (result.success) {
      toast.success("Recurring transaction deleted");
      setTransactions((prev) => prev.filter((t) => t.id !== transaction.id));
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete");
    }
  };

  const handleToggleActive = async (
    transaction: RecurringTransactionWithCategory
  ) => {
    const newStatus = !transaction.isActive;
    const result = await toggleRecurringTransactionActive(
      transaction.id,
      newStatus
    );

    if (result.success) {
      toast.success(
        newStatus
          ? "Recurring transaction activated"
          : "Recurring transaction deactivated"
      );
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transaction.id ? { ...t, isActive: newStatus } : t
        )
      );
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update status");
    }
  };

  const handleFormSuccess = () => {
    router.refresh();
    // Refresh the transactions list
    // Note: In a real app, you might want to fetch the updated list
    // For now, router.refresh() will trigger a server-side refresh
  };

  const handleRowClick = (transaction: RecurringTransactionWithCategory) => {
    // For now, just edit. Later we can add a details sheet
    handleEdit(transaction);
  };

  const handleMatchTransactions = async (transaction: RecurringTransactionWithCategory) => {
    const result = await matchTransactionsToRecurring(transaction.id);

    if (result.success) {
      toast.success(
        `Matched ${result.matchedCount || 0} transaction(s) to "${transaction.name}"`
      );
      router.refresh();
    } else {
      toast.error(result.error || "Failed to match transactions");
    }
  };

  return (
    <>
      <RecurringTransactionsTable
        transactions={transactions}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        onRowClick={handleRowClick}
        onMatchTransactions={handleMatchTransactions}
      />

      <RecurringTransactionFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        transaction={editingTransaction}
        categories={categories}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}
