"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  createRecurringTransaction,
  updateRecurringTransaction,
  type RecurringTransactionCreateInput,
  type RecurringTransactionUpdateInput,
} from "@/lib/actions/recurring-transactions";
import type { RecurringTransaction } from "@/lib/db/schema";
import { RiStarFill, RiStarLine } from "@remixicon/react";

interface RecurringTransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: RecurringTransaction | null;
  categories: Array<{ id: string; name: string; color: string | null }>;
  onSuccess?: () => void;
}

const frequencyOptions = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export function RecurringTransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  categories,
  onSuccess,
}: RecurringTransactionFormDialogProps) {
  const [name, setName] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [importance, setImportance] = useState(3);
  const [frequency, setFrequency] = useState<string>("monthly");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!transaction;

  // Reset form when dialog opens/closes or transaction changes
  useEffect(() => {
    if (open) {
      if (transaction) {
        // Edit mode - populate with existing data
        setName(transaction.name);
        setMerchant(transaction.merchant || "");
        setAmount(transaction.amount);
        setCategoryId(transaction.categoryId || "");
        setImportance(transaction.importance);
        setFrequency(transaction.frequency);
        setDescription(transaction.description || "");
      } else {
        // Create mode - reset to defaults
        setName("");
        setMerchant("");
        setAmount("");
        setCategoryId("");
        setImportance(3);
        setFrequency("monthly");
        setDescription("");
      }
    }
  }, [open, transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    if (importance < 1 || importance > 5) {
      toast.error("Importance must be between 1 and 5");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode) {
        // Update existing
        const input: RecurringTransactionUpdateInput = {
          name: name.trim(),
          merchant: merchant.trim() || undefined,
          amount: amountNum,
          categoryId: categoryId || undefined,
          importance,
          frequency: frequency as any,
          description: description.trim() || undefined,
        };

        const result = await updateRecurringTransaction(transaction.id, input);

        if (result.success) {
          toast.success("Recurring transaction updated");
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(result.error || "Failed to update");
        }
      } else {
        // Create new
        const input: RecurringTransactionCreateInput = {
          name: name.trim(),
          merchant: merchant.trim() || undefined,
          amount: amountNum,
          categoryId: categoryId || undefined,
          importance,
          frequency: frequency as any,
          description: description.trim() || undefined,
        };

        const result = await createRecurringTransaction(input);

        if (result.success) {
          toast.success("Recurring transaction created");
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(result.error || "Failed to create");
        }
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Recurring Transaction" : "Add Recurring Transaction"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the details of this recurring transaction."
              : "Create a new recurring transaction to track subscriptions and bills."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Netflix, Rent, Gym Membership"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Merchant */}
            <div className="grid gap-2">
              <Label htmlFor="merchant">Merchant</Label>
              <Input
                id="merchant"
                placeholder="e.g., Netflix Inc"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </div>

            {/* Amount */}
            <div className="grid gap-2">
              <Label htmlFor="amount">
                Amount <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            {/* Category */}
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Uncategorized</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frequency */}
            <div className="grid gap-2">
              <Label htmlFor="frequency">
                Frequency <span className="text-destructive">*</span>
              </Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Importance */}
            <div className="grid gap-2">
              <Label>
                Importance <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const starValue = i + 1;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setImportance(starValue)}
                      className="focus:outline-none"
                    >
                      {starValue <= importance ? (
                        <RiStarFill className="h-6 w-6 text-yellow-500 cursor-pointer hover:scale-110 transition-transform" />
                      ) : (
                        <RiStarLine className="h-6 w-6 text-muted-foreground cursor-pointer hover:text-yellow-500 hover:scale-110 transition-transform" />
                      )}
                    </button>
                  );
                })}
                <span className="ml-2 text-sm text-muted-foreground">
                  ({importance}/5)
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional notes about this recurring transaction"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                ? "Update"
                : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
