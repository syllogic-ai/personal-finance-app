"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { MockTransaction } from "@/lib/mock-data";
import { TransactionSheet } from "./transaction-sheet";

interface TransactionTableProps {
  transactions: MockTransaction[];
  onUpdateTransaction?: (id: string, updates: Partial<MockTransaction>) => void;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
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

export function TransactionTable({ transactions, onUpdateTransaction }: TransactionTableProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<MockTransaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((tx) => tx.id)));
    }
  };

  const handleRowClick = (transaction: MockTransaction) => {
    setSelectedTransaction(transaction);
  };

  const handleUpdateTransaction = (id: string, updates: Partial<MockTransaction>) => {
    onUpdateTransaction?.(id, updates);
    if (selectedTransaction?.id === id) {
      setSelectedTransaction((prev) => prev ? { ...prev, ...updates } : null);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={selectedIds.size === transactions.length && transactions.length > 0}
                onCheckedChange={toggleAllSelection}
              />
            </TableHead>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead className="min-w-[200px]">Description</TableHead>
            <TableHead className="w-[120px]">Amount</TableHead>
            <TableHead className="w-[150px]">Category</TableHead>
            <TableHead className="w-[180px]">Account</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow
              key={transaction.id}
              className="cursor-pointer"
              onClick={() => handleRowClick(transaction)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(transaction.id)}
                  onCheckedChange={() => toggleSelection(transaction.id)}
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(transaction.bookedAt)}
              </TableCell>
              <TableCell>
                <span className={cn(transaction.amount > 0 && "text-[#22C55E]")}>
                  {transaction.description}
                </span>
              </TableCell>
              <TableCell>
                <span className={cn("font-medium", transaction.amount > 0 && "text-[#22C55E]")}>
                  {formatAmount(transaction.amount, transaction.currency)}
                </span>
              </TableCell>
              <TableCell>
                {transaction.category ? (
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 shrink-0"
                      style={{ backgroundColor: transaction.category.color }}
                    />
                    <span className="truncate">{transaction.category.name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Uncategorized</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">{transaction.account.name}</span>
              </TableCell>
              <TableCell>
                {transaction.pending ? (
                  <span className="text-muted-foreground text-xs border rounded px-1.5 py-0.5">
                    Pending
                  </span>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TransactionSheet
        transaction={selectedTransaction}
        open={selectedTransaction !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTransaction(null);
        }}
        onUpdateTransaction={handleUpdateTransaction}
      />
    </>
  );
}
