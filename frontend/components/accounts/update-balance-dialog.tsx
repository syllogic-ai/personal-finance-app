"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { RiCalendarLine, RiLoader4Line } from "@remixicon/react";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createOrUpdateBalancingTransaction } from "@/lib/actions/transactions";
import { getCategoryByName } from "@/lib/actions/categories";
import { getAccountBalanceOnDate } from "@/lib/actions/accounts";

interface UpdateBalanceDialogProps {
  account: {
    id: string;
    name: string;
    currency: string | null;
    functionalBalance: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UpdateBalanceDialog({
  account,
  open,
  onOpenChange,
  onSuccess,
}: UpdateBalanceDialogProps) {
  const [newBalance, setNewBalance] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balancingCategoryId, setBalancingCategoryId] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [balanceOnDate, setBalanceOnDate] = useState<number>(0);

  const currency = account.currency || "EUR";
  const newBalanceValue = parseFloat(newBalance) || 0;
  const difference = newBalanceValue - balanceOnDate;

  // Fetch balance for a specific date
  const fetchBalanceForDate = useCallback(async (date: Date) => {
    setIsLoadingBalance(true);
    try {
      const result = await getAccountBalanceOnDate(account.id, date);
      setBalanceOnDate(result.balance);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      // Fallback to current balance
      setBalanceOnDate(parseFloat(account.functionalBalance || "0"));
    } finally {
      setIsLoadingBalance(false);
    }
  }, [account.id, account.functionalBalance]);

  // Fetch the "Balancing Transfer" category and initial balance on mount
  useEffect(() => {
    async function initialize() {
      const category = await getCategoryByName("Balancing Transfer");
      if (category) {
        setBalancingCategoryId(category.id);
      }
    }
    if (open) {
      initialize();
      // Reset form when dialog opens
      setNewBalance("");
      const today = new Date();
      setAdjustmentDate(today);
      fetchBalanceForDate(today);
    }
  }, [open, fetchBalanceForDate]);

  // Fetch balance when date changes
  const handleDateChange = (date: Date) => {
    setAdjustmentDate(date);
    setIsCalendarOpen(false);
    fetchBalanceForDate(date);
  };

  const formatCurrencyValue = (value: number, showSign: boolean = false) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      signDisplay: showSign ? "always" : "auto",
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!balancingCategoryId) {
      toast.error("Balancing Transfer category not found. Please ensure it exists.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await createOrUpdateBalancingTransaction({
        accountId: account.id,
        targetBalance: newBalanceValue,
        adjustmentDate,
        balancingCategoryId,
      });

      if (result.success) {
        const message = result.isUpdate
          ? "Balance adjustment updated successfully"
          : "Balance updated successfully";
        toast.success(message);
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to update balance");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Balance</DialogTitle>
          <DialogDescription>
            Adjust the balance for {account.name}. An adjustment transaction will be created.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Adjustment Date</Label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger
                  className={cn(
                    "flex h-9 w-full items-center justify-start gap-2 border border-input bg-transparent px-3 text-sm hover:bg-muted transition-colors",
                    !adjustmentDate && "text-muted-foreground"
                  )}
                >
                  <RiCalendarLine className="h-4 w-4" />
                  {adjustmentDate ? format(adjustmentDate, "PPP") : "Select date"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={adjustmentDate}
                    onSelect={(date) => {
                      if (date) {
                        handleDateChange(date);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Balance on {format(adjustmentDate, "MMM d, yyyy")}</Label>
              <div className="flex items-center gap-2 text-lg font-medium">
                {isLoadingBalance ? (
                  <RiLoader4Line className="h-4 w-4 animate-spin" />
                ) : (
                  formatCurrencyValue(balanceOnDate)
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-balance">Correct Balance</Label>
              <Input
                id="new-balance"
                type="number"
                step="0.01"
                placeholder="Enter correct balance"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                autoFocus
              />
            </div>

            {newBalance !== "" && difference !== 0 && (
              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-sm text-muted-foreground">Adjustment Amount</Label>
                <div
                  className={cn(
                    "text-lg font-medium",
                    difference > 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {formatCurrencyValue(difference, true)}
                </div>
                <p className="text-xs text-muted-foreground">
                  A {difference > 0 ? "credit" : "debit"} transaction will be created with category
                  &quot;Balancing Transfer&quot;
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isLoadingBalance || !newBalance || !balancingCategoryId}
            >
              {isLoading ? "Updating..." : "Update Balance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
