"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  RiPriceTag3Line,
  RiDownloadLine,
  RiCloseLine,
  RiDeleteBinLine,
} from "@remixicon/react";
import { Dock, DockIcon } from "@/components/ui/dock";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { bulkUpdateTransactionCategory } from "@/lib/actions/transactions";
import { exportTransactionsToCSV } from "@/lib/utils/csv-export";
import type { CategoryDisplay } from "@/types";
import type { TransactionWithRelations } from "@/lib/actions/transactions";

interface BulkActionsDockProps {
  selectedCount: number;
  selectedIds: string[];
  selectedTransactions: TransactionWithRelations[];
  categories: CategoryDisplay[];
  onClearSelection: () => void;
  onBulkUpdate: (categoryId: string | null) => void;
}

export function BulkActionsDock({
  selectedCount,
  selectedIds,
  selectedTransactions,
  categories,
  onClearSelection,
  onBulkUpdate,
}: BulkActionsDockProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleCategorize = async (categoryId: string | null) => {
    setIsLoading(true);
    try {
      const result = await bulkUpdateTransactionCategory(selectedIds, categoryId);

      if (result.success) {
        toast.success(`Updated ${result.updatedCount} transactions`);
        onBulkUpdate(categoryId);
        onClearSelection();
        setCategoryPopoverOpen(false);
      } else {
        toast.error(result.error || "Failed to update transactions");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (selectedTransactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    try {
      exportTransactionsToCSV(selectedTransactions);
      toast.success(`Exported ${selectedTransactions.length} transactions`);
    } catch {
      toast.error("Failed to export transactions");
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <Dock
        direction="middle"
        className="h-14 px-4 gap-3 bg-background/95 border shadow-lg"
        disableMagnification
      >
        {/* Selection count */}
        <div className="flex items-center gap-2 px-2 text-sm font-medium">
          <span>{selectedCount} selected</span>
        </div>

        <Separator orientation="vertical" className="h-8" />

        {/* Categorize */}
        <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
          <Tooltip>
            <PopoverTrigger>
              <TooltipTrigger>
                <DockIcon className="bg-muted hover:bg-muted/80">
                  <RiPriceTag3Line className="size-5" />
                </DockIcon>
              </TooltipTrigger>
            </PopoverTrigger>
            <TooltipContent side="top" sideOffset={8}>
              <p>Categorize</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-56 p-0" align="center" side="top" sideOffset={12}>
            <div className="p-2 border-b">
              <p className="text-xs font-medium text-muted-foreground">
                Select category
              </p>
            </div>
            <ScrollArea className="max-h-64">
              <div className="p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => handleCategorize(null)}
                  disabled={isLoading}
                >
                  <RiDeleteBinLine className="mr-2 h-4 w-4" />
                  Remove category
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleCategorize(category.id)}
                    disabled={isLoading}
                  >
                    <div
                      className="mr-2 h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: category.color || "#666" }}
                    />
                    <span className="truncate">{category.name}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Export */}
        <Tooltip>
          <TooltipTrigger>
            <DockIcon
              className="bg-muted hover:bg-muted/80"
              onClick={handleExport}
            >
              <RiDownloadLine className="size-5" />
            </DockIcon>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            <p>Export CSV</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-8" />

        {/* Clear selection */}
        <Tooltip>
          <TooltipTrigger>
            <DockIcon
              className="bg-muted hover:bg-destructive/20 hover:text-destructive"
              onClick={onClearSelection}
            >
              <RiCloseLine className="size-5" />
            </DockIcon>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            <p>Clear selection</p>
          </TooltipContent>
        </Tooltip>
      </Dock>
    </div>
  );
}
