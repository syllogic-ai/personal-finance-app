"use client";

import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { createRecurringTransactionColumns } from "./columns";
import type { RecurringTransaction } from "@/lib/db/schema";
import { RiAddLine } from "@remixicon/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RecurringTransactionWithCategory extends RecurringTransaction {
  category?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface RecurringTransactionsTableProps {
  transactions: RecurringTransactionWithCategory[];
  onAdd: () => void;
  onEdit: (transaction: RecurringTransactionWithCategory) => void;
  onDelete: (transaction: RecurringTransactionWithCategory) => void;
  onToggleActive: (transaction: RecurringTransactionWithCategory) => void;
  onRowClick: (transaction: RecurringTransactionWithCategory) => void;
  onMatchTransactions?: (transaction: RecurringTransactionWithCategory) => void;
}

export function RecurringTransactionsTable({
  transactions,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
  onRowClick,
  onMatchTransactions,
}: RecurringTransactionsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] =
    useState<RecurringTransactionWithCategory | null>(null);

  const handleDeleteClick = (transaction: RecurringTransactionWithCategory) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (transactionToDelete) {
      onDelete(transactionToDelete);
    }
    setDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  const columns = createRecurringTransactionColumns({
    onEdit,
    onDelete: handleDeleteClick,
    onToggleActive,
    onMatchTransactions,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={transactions}
        onRowClick={onRowClick}
        enableColumnResizing={true}
        enableRowSelection={false}
        enablePagination={true}
        pageSize={20}
        toolbar={() => (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Recurring Transactions</h2>
              <span className="text-sm text-muted-foreground">
                ({transactions.length})
              </span>
            </div>
            <Button onClick={onAdd}>
              <RiAddLine className="mr-2 h-4 w-4" />
              Add Recurring Transaction
            </Button>
          </div>
        )}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{transactionToDelete?.name}"? This
              action cannot be undone. Linked transactions will be unlinked but not
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
