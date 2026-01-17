"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { TransactionTable } from "@/components/transactions";
import { mockTransactions, type MockTransaction } from "@/lib/mock-data";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<MockTransaction[]>(mockTransactions);

  const handleUpdateTransaction = (id: string, updates: Partial<MockTransaction>) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, ...updates } : tx))
    );
  };

  return (
    <>
      <Header title="Transactions" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <TransactionTable
          transactions={transactions}
          onUpdateTransaction={handleUpdateTransaction}
        />
      </div>
    </>
  );
}
