"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  RiExternalLinkLine,
  RiLinkUnlinkM,
} from "@remixicon/react";
import Link from "next/link";
import { toast } from "sonner";
import type { TransactionWithRelations } from "@/lib/actions/transactions";
import { unlinkTransactionFromSubscription } from "@/lib/actions/subscriptions";

interface SubscriptionLinkedDialogProps {
  transaction: TransactionWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const frequencyLabels: Record<string, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  yearly: "Yearly",
  quarterly: "Quarterly",
  biweekly: "Bi-weekly",
};

const frequencyColors: Record<string, string> = {
  monthly: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  weekly: "bg-green-500/10 text-green-700 dark:text-green-400",
  yearly: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  quarterly: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  biweekly: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
};

export function SubscriptionLinkedDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: SubscriptionLinkedDialogProps) {
  const [isUnlinking, setIsUnlinking] = useState(false);

  const subscription = transaction.recurringTransaction;

  if (!subscription) return null;

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      const result = await unlinkTransactionFromSubscription(transaction.id);

      if (result.success) {
        toast.success("Transaction unlinked from subscription");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to unlink transaction");
      }
    } catch (error) {
      toast.error("Failed to unlink transaction");
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Linked Subscription</DialogTitle>
          <DialogDescription>
            This transaction is linked to a subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Subscription Info */}
          <div className="bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{subscription.name}</h3>
              <Badge variant="secondary" className={frequencyColors[subscription.frequency]}>
                {frequencyLabels[subscription.frequency] || subscription.frequency}
              </Badge>
            </div>

            {subscription.merchant && (
              <div className="text-sm text-muted-foreground">
                Merchant: {subscription.merchant}
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <Link href="/subscriptions" className="block">
              <Button
                variant="outline"
                className="w-full justify-start"
              >
                <RiExternalLinkLine className="h-4 w-4 mr-2" />
                View All Subscriptions
              </Button>
            </Link>

            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    disabled={isUnlinking}
                  >
                    <RiLinkUnlinkM className="h-4 w-4 mr-2" />
                    {isUnlinking ? "Unlinking..." : "Unlink from Subscription"}
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlink Transaction?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the link between this transaction and the subscription
                    "{subscription.name}". The subscription itself will not be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleUnlink}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Unlink
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
