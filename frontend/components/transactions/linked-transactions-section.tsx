"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { RiLink, RiAddLine, RiCloseLine, RiLoader4Line, RiArrowDownSLine, RiArrowUpSLine } from "@remixicon/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn, formatAmount } from "@/lib/utils";
import {
  getTransactionLinkGroup,
  deleteLinkGroup,
  removeTransactionFromLinkGroup,
  type TransactionLinkGroup,
} from "@/lib/actions/transaction-links";

interface LinkedTransactionsSectionProps {
  transactionId: string;
  currency: string;
  onLinkClick: () => void;
  onUpdate: () => void;
}

export function LinkedTransactionsSection({
  transactionId,
  currency,
  onLinkClick,
  onUpdate,
}: LinkedTransactionsSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [linkGroup, setLinkGroup] = useState<TransactionLinkGroup | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadLinkGroup();
  }, [transactionId]);

  const loadLinkGroup = async () => {
    setIsLoading(true);
    try {
      const group = await getTransactionLinkGroup(transactionId);
      setLinkGroup(group);
    } catch (error) {
      console.error("Failed to load link group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlinkAll = async () => {
    if (!linkGroup) return;

    setIsUnlinking(true);
    try {
      const result = await deleteLinkGroup(linkGroup.groupId);
      if (result.success) {
        toast.success("Transactions unlinked");
        setLinkGroup(null);
        onUpdate();
      } else {
        toast.error(result.error || "Failed to unlink transactions");
      }
    } catch (error) {
      toast.error("Failed to unlink transactions");
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleRemoveLinked = async (linkedTxnId: string) => {
    setIsUnlinking(true);
    try {
      const result = await removeTransactionFromLinkGroup(linkedTxnId);
      if (result.success) {
        toast.success("Transaction removed from group");
        if (result.groupDeleted) {
          setLinkGroup(null);
        } else {
          await loadLinkGroup();
        }
        onUpdate();
      } else {
        toast.error(result.error || "Failed to remove transaction");
      }
    } catch (error) {
      toast.error("Failed to remove transaction");
    } finally {
      setIsUnlinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <RiLink className="h-4 w-4" />
          <span className="text-sm font-medium">Linked Transactions</span>
        </div>
        <div className="flex items-center justify-center py-4">
          <RiLoader4Line className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Not linked - show link button
  if (!linkGroup) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <RiLink className="h-4 w-4" />
          <span className="text-sm font-medium">Linked Transactions</span>
        </div>
        <Button variant="outline" className="w-full" onClick={onLinkClick}>
          <RiLink className="h-4 w-4 mr-2" />
          Link Reimbursements
        </Button>
      </div>
    );
  }

  // Linked - show group details
  const allLinked = [...(linkGroup.primary ? [linkGroup.primary] : []), ...linkGroup.linked];

  return (
    <div>
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-3 bg-muted/50 hover:bg-muted/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <RiLink className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Linked ({allLinked.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-mono font-medium",
              linkGroup.netAmount > 0 ? "text-emerald-600" : "text-foreground"
            )}
          >
            {formatAmount(linkGroup.netAmount, currency)}
          </span>
          {isExpanded ? (
            <RiArrowUpSLine className="h-4 w-4 text-muted-foreground" />
          ) : (
            <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="border-x border-b bg-muted/30 p-3 space-y-3">
          {/* Transaction List */}
          <div className="space-y-2">
            {allLinked.map((txn) => (
              <div
                key={txn.id}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  txn.id === transactionId && "font-medium"
                )}
              >
                {txn.linkRole === "primary" && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    Primary
                  </Badge>
                )}
                <span
                  className={cn(
                    "font-mono shrink-0",
                    txn.amount > 0 && "text-emerald-600"
                  )}
                >
                  {txn.amount > 0 ? "+" : ""}
                  {Math.abs(txn.amount).toFixed(2)}
                </span>
                <span className="truncate flex-1 text-muted-foreground">
                  {txn.merchant || txn.description || format(new Date(txn.bookedAt), "MMM d")}
                </span>
                {txn.id !== transactionId && txn.linkRole !== "primary" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveLinked(txn.id);
                    }}
                    disabled={isUnlinking}
                  >
                    <RiCloseLine className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onLinkClick();
              }}
              disabled={isUnlinking}
            >
              <RiAddLine className="h-4 w-4 mr-1" />
              Add More
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                nativeButton={true}
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-destructive hover:text-destructive"
                    disabled={isUnlinking}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Unlink All
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlink all transactions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all links between these transactions. They will be treated
                    as separate transactions in analytics.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnlinkAll}>Unlink All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}
