"use client";

import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { createSubscriptionColumns } from "./columns";
import { SubscriptionsSummaryRow } from "./subscriptions-summary-row";
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

interface SubscriptionWithCategory extends RecurringTransaction {
  category?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface SubscriptionsTableProps {
  subscriptions: SubscriptionWithCategory[];
  onAdd: () => void;
  onEdit: (subscription: SubscriptionWithCategory) => void;
  onDelete: (subscription: SubscriptionWithCategory) => void;
  onToggleActive: (subscription: SubscriptionWithCategory) => void;
  onRowClick: (subscription: SubscriptionWithCategory) => void;
}

export function SubscriptionsTable({
  subscriptions,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
  onRowClick,
}: SubscriptionsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subscriptionToDelete, setSubscriptionToDelete] =
    useState<SubscriptionWithCategory | null>(null);

  const handleDeleteClick = (subscription: SubscriptionWithCategory) => {
    setSubscriptionToDelete(subscription);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (subscriptionToDelete) {
      onDelete(subscriptionToDelete);
    }
    setDeleteDialogOpen(false);
    setSubscriptionToDelete(null);
  };

  const columns = createSubscriptionColumns({
    onEdit,
    onDelete: handleDeleteClick,
    onToggleActive,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={subscriptions}
        onRowClick={onRowClick}
        enableColumnResizing={true}
        enableRowSelection={false}
        enablePagination={true}
        pageSize={20}
        toolbar={() => (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Subscriptions</h2>
              <span className="text-sm text-muted-foreground">
                ({subscriptions.length})
              </span>
            </div>
            <Button onClick={onAdd}>
              <RiAddLine className="mr-2 h-4 w-4" />
              Add Subscription
            </Button>
          </div>
        )}
        footer={<SubscriptionsSummaryRow subscriptions={subscriptions} />}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{subscriptionToDelete?.name}"? This
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
