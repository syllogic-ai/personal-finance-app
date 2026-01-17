"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { MockTransaction } from "@/lib/mock-data";
import { mockCategories, type MockCategory } from "@/lib/mock-data";

interface TransactionSheetProps {
  transaction: MockTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTransaction?: (id: string, updates: Partial<MockTransaction>) => void;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatAmount(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return amount < 0 ? `-${formatted}` : formatted;
}

export function TransactionSheet({
  transaction,
  open,
  onOpenChange,
  onUpdateTransaction,
}: TransactionSheetProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when transaction changes
  useEffect(() => {
    if (transaction) {
      setSelectedCategoryId(transaction.categoryId);
      setInstructions(transaction.categorizationInstructions || "");
      setHasChanges(false);
    }
  }, [transaction]);

  const handleCategoryChange = (value: string) => {
    const newCategoryId = value === "uncategorized" ? null : value;
    setSelectedCategoryId(newCategoryId);
    setHasChanges(
      newCategoryId !== transaction?.categoryId ||
        instructions !== (transaction?.categorizationInstructions || "")
    );
  };

  const handleInstructionsChange = (value: string) => {
    setInstructions(value);
    setHasChanges(
      selectedCategoryId !== transaction?.categoryId ||
        value !== (transaction?.categorizationInstructions || "")
    );
  };

  const handleSave = () => {
    if (!transaction || !hasChanges) return;

    const newCategory = selectedCategoryId
      ? mockCategories.find((cat) => cat.id === selectedCategoryId) || null
      : null;

    onUpdateTransaction?.(transaction.id, {
      categoryId: selectedCategoryId,
      category: newCategory,
      categorizationInstructions: instructions || null,
    });

    setHasChanges(false);
  };

  if (!transaction) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetDescription className="text-muted-foreground">
            {formatDate(transaction.bookedAt)}
          </SheetDescription>
          <SheetTitle className="text-lg font-medium">
            {transaction.description}
          </SheetTitle>
          <div
            className={cn(
              "text-3xl font-semibold tracking-tight pt-2",
              transaction.amount > 0 && "text-[#22C55E]"
            )}
          >
            {formatAmount(transaction.amount, transaction.currency)}
          </div>
        </SheetHeader>

        <Separator className="my-6" />

        <div className="space-y-6">
          {/* Category Section */}
          <div className="space-y-3">
            <Label htmlFor="category">Category</Label>
            <Select
              value={selectedCategoryId || "uncategorized"}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Select category">
                  {selectedCategoryId ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 shrink-0"
                        style={{
                          backgroundColor:
                            mockCategories.find((c) => c.id === selectedCategoryId)?.color ||
                            "#A1A1AA",
                        }}
                      />
                      <span>
                        {mockCategories.find((c) => c.id === selectedCategoryId)?.name ||
                          "Unknown"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 shrink-0 bg-muted-foreground/30" />
                      <span className="text-muted-foreground">Uncategorized</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uncategorized">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 shrink-0 bg-muted-foreground/30" />
                    <span>Uncategorized</span>
                  </div>
                </SelectItem>
                {mockCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Show AI-assigned category if different from user selection */}
            {transaction.categorySystemId &&
              transaction.categorySystemId !== selectedCategoryId && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>AI suggested:</span>
                  <span
                    className="inline-flex items-center gap-1"
                  >
                    <span
                      className="h-2 w-2 shrink-0 inline-block"
                      style={{ backgroundColor: transaction.categorySystem?.color || "#A1A1AA" }}
                    />
                    {transaction.categorySystem?.name || "Unknown"}
                  </span>
                </p>
              )}
          </div>

          {/* Categorization Instructions */}
          <div className="space-y-3">
            <Label htmlFor="instructions">Categorization Instructions</Label>
            <Textarea
              id="instructions"
              placeholder="Add instructions for how this merchant or similar transactions should be categorized in the future..."
              value={instructions}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              These instructions will help the AI categorize similar transactions automatically.
            </p>
          </div>

          <Separator />

          {/* Transaction Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Details</h3>

            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Merchant</span>
                <span>{transaction.merchant || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account</span>
                <span>{transaction.account.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Institution</span>
                <span>{transaction.account.institution}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span>{transaction.pending ? "Pending" : "Completed"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Save Button */}
        <div className="mt-6 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="w-full"
          >
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
