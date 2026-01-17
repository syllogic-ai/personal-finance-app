"use client";

import { RiDownloadLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportTransactionsToCSV } from "@/lib/utils/csv-export";
import type { TransactionWithRelations } from "@/lib/actions/transactions";

interface ExportButtonProps {
  transactions: TransactionWithRelations[];
  disabled?: boolean;
}

export function ExportButton({ transactions, disabled }: ExportButtonProps) {
  const handleExport = () => {
    if (transactions.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    try {
      exportTransactionsToCSV(transactions);
      toast.success(`Exported ${transactions.length} transactions`);
    } catch {
      toast.error("Failed to export transactions");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={disabled || transactions.length === 0}
    >
      <RiDownloadLine className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
}
