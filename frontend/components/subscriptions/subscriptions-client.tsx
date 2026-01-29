"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SubscriptionsTable } from "./subscriptions-table";
import { SubscriptionFormDialog } from "./subscription-form-dialog";
import { SubscriptionDetailSheet } from "./subscription-detail-sheet";
import { toast } from "sonner";
import {
  deleteSubscription,
  toggleSubscriptionActive,
} from "@/lib/actions/subscriptions";
import type { RecurringTransaction } from "@/lib/db/schema";

interface SubscriptionWithCategory extends RecurringTransaction {
  category?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface SubscriptionsClientProps {
  initialSubscriptions: SubscriptionWithCategory[];
  categories: Array<{ id: string; name: string; color: string | null }>;
}

export function SubscriptionsClient({
  initialSubscriptions,
  categories,
}: SubscriptionsClientProps) {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] =
    useState<SubscriptionWithCategory | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] =
    useState<SubscriptionWithCategory | null>(null);

  const handleAdd = () => {
    setEditingSubscription(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (subscription: SubscriptionWithCategory) => {
    setEditingSubscription(subscription);
    setFormDialogOpen(true);
  };

  const handleDelete = async (subscription: SubscriptionWithCategory) => {
    const result = await deleteSubscription(subscription.id);

    if (result.success) {
      toast.success("Subscription deleted");
      setSubscriptions((prev) => prev.filter((t) => t.id !== subscription.id));
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete");
    }
  };

  const handleToggleActive = async (
    subscription: SubscriptionWithCategory
  ) => {
    const newStatus = !subscription.isActive;
    const result = await toggleSubscriptionActive(
      subscription.id,
      newStatus
    );

    if (result.success) {
      toast.success(
        newStatus
          ? "Subscription activated"
          : "Subscription deactivated"
      );
      setSubscriptions((prev) =>
        prev.map((t) =>
          t.id === subscription.id ? { ...t, isActive: newStatus } : t
        )
      );
      router.refresh();
    } else {
      toast.error(result.error || "Failed to update status");
    }
  };

  const handleFormSuccess = () => {
    router.refresh();
  };

  const handleRowClick = (subscription: SubscriptionWithCategory) => {
    setSelectedSubscription(subscription);
    setDetailSheetOpen(true);
  };

  const handleEditFromDetail = (subscription: SubscriptionWithCategory) => {
    setDetailSheetOpen(false);
    handleEdit(subscription);
  };

  return (
    <>
      <SubscriptionsTable
        subscriptions={subscriptions}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        onRowClick={handleRowClick}
      />

      <SubscriptionFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        subscription={editingSubscription}
        categories={categories}
        onSuccess={handleFormSuccess}
      />

      <SubscriptionDetailSheet
        subscription={selectedSubscription}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onEdit={handleEditFromDetail}
        onRefresh={() => router.refresh()}
      />
    </>
  );
}
