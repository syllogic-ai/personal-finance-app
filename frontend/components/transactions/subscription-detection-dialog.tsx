"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RiLoader4Line, RiAlertLine, RiRepeatLine, RiLightbulbLine } from "@remixicon/react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { TransactionWithRelations } from "@/lib/actions/transactions";
import type { CategoryDisplay } from "@/types";
import {
  detectSubscriptionFromTransaction,
  createSubscriptionFromTransaction,
  type SubscriptionDetectionResult,
  type SubscriptionFrequency,
} from "@/lib/actions/subscriptions";

interface SubscriptionDetectionDialogProps {
  transaction: TransactionWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  categories: CategoryDisplay[];
}

const frequencyOptions: { value: SubscriptionFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

const frequencyColors: Record<string, string> = {
  monthly: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  weekly: "bg-green-500/10 text-green-700 dark:text-green-400",
  yearly: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  quarterly: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  biweekly: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
};

export function SubscriptionDetectionDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
  categories,
}: SubscriptionDetectionDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [detectionResult, setDetectionResult] = useState<SubscriptionDetectionResult | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<SubscriptionFrequency>("monthly");
  const [categoryId, setCategoryId] = useState<string>("");
  const [importance, setImportance] = useState(2);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());

  // Run detection when dialog opens
  useEffect(() => {
    if (open && transaction) {
      runDetection();
    }
  }, [open, transaction?.id]);

  const runDetection = async () => {
    setIsLoading(true);
    try {
      const result = await detectSubscriptionFromTransaction(transaction.id);
      setDetectionResult(result);

      if (result.success) {
        // Set form defaults from detection result
        setName(result.suggestedName);
        setFrequency(result.detectedFrequency || "monthly");
        setCategoryId(transaction.categoryId || "");
        setImportance(2);

        // Select all matched transactions by default
        setSelectedTransactionIds(new Set(result.matchedTransactions.map((t) => t.id)));
      }
    } catch (error) {
      console.error("Detection failed:", error);
      toast.error("Failed to detect subscription pattern");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createSubscriptionFromTransaction({
        transactionId: transaction.id,
        name: name.trim(),
        frequency,
        categoryId: categoryId || undefined,
        importance,
        matchedTransactionIds: Array.from(selectedTransactionIds),
      });

      if (result.success) {
        toast.success(
          `Subscription "${name}" created with ${result.linkedCount} linked transaction(s)`
        );
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to create subscription");
      }
    } catch (error) {
      toast.error("Failed to create subscription");
    } finally {
      setIsCreating(false);
    }
  };

  const toggleTransaction = (txnId: string) => {
    const newSet = new Set(selectedTransactionIds);
    if (newSet.has(txnId)) {
      newSet.delete(txnId);
    } else {
      newSet.add(txnId);
    }
    setSelectedTransactionIds(newSet);
  };

  const getConfidenceLabel = (confidence: number): { label: string; className: string } => {
    if (confidence >= 70) {
      return { label: "High", className: "bg-green-500/10 text-green-700 dark:text-green-400" };
    } else if (confidence >= 40) {
      return { label: "Medium", className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" };
    } else {
      return { label: "Low", className: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark as Subscription</DialogTitle>
          <DialogDescription>
            Create a subscription from this transaction and link similar past transactions.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <RiLoader4Line className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Detecting subscription pattern...</p>
          </div>
        ) : detectionResult && detectionResult.success ? (
          <div className="space-y-6">
            {/* Inline Detection Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={frequencyColors[frequency]}>
                <RiRepeatLine className="mr-1 h-3 w-3" />
                {frequencyOptions.find((f) => f.value === frequency)?.label || "Monthly"}
              </Badge>
              <Badge variant="secondary" className={getConfidenceLabel(detectionResult.confidence).className}>
                <RiLightbulbLine className="mr-1 h-3 w-3" />
                {getConfidenceLabel(detectionResult.confidence).label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {detectionResult.matchedTransactions.length} matching transaction(s)
              </span>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="sub-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sub-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Netflix, Spotify"
                />
              </div>

              {/* Frequency & Category on same row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Frequency */}
                <div className="space-y-2">
                  <Label htmlFor="sub-frequency">
                    Frequency <span className="text-destructive">*</span>
                  </Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as SubscriptionFrequency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                          {detectionResult.detectedFrequency === option.value && " (Detected)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="sub-category">Category</Label>
                  <Select value={categoryId || "uncategorized"} onValueChange={(v) => setCategoryId(v === "uncategorized" || v === null ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncategorized">Uncategorized</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 shrink-0"
                              style={{ backgroundColor: cat.color || "#A1A1AA" }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Importance - 3 blocks */}
              <div className="space-y-2">
                <Label>Importance</Label>
                <div className="flex items-center gap-2">
                  {Array.from({ length: 3 }).map((_, i) => {
                    const blockValue = i + 1;
                    const isSelected = blockValue <= importance;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setImportance(blockValue)}
                        className={`h-6 w-8 border transition-colors cursor-pointer hover:border-foreground ${
                          isSelected
                            ? "bg-foreground border-foreground"
                            : "bg-background border-border"
                        }`}
                      />
                    );
                  })}
                  <span className="ml-2 text-sm text-muted-foreground">({importance}/3)</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Matched Transactions */}
            {detectionResult.matchedTransactions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Transactions to Link ({selectedTransactionIds.size} selected)</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTransactionIds(new Set(detectionResult.matchedTransactions.map((t) => t.id)))}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTransactionIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="max-h-[200px] overflow-y-auto border divide-y">
                  {detectionResult.matchedTransactions.map((txn) => (
                    <label
                      key={txn.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTransactionIds.has(txn.id)}
                        onChange={() => toggleTransaction(txn.id)}
                        className="h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm truncate">
                            {txn.merchant || txn.description || "Transaction"}
                          </span>
                          <span className="text-sm font-mono shrink-0">
                            {Math.abs(txn.amount).toFixed(2)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(txn.bookedAt), "MMM d, yyyy")}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <RiAlertLine className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {detectionResult?.error || "Failed to detect subscription pattern"}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isLoading || isCreating || !name.trim()}
          >
            {isCreating ? "Creating..." : "Create Subscription"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
