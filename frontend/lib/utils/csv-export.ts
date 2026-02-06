import type { TransactionWithRelations } from "@/lib/actions/transactions";

/**
 * Export transactions to a CSV file and trigger download
 */
export function exportTransactionsToCSV(
  transactions: TransactionWithRelations[],
  filename?: string
): void {
  if (transactions.length === 0) {
    return;
  }

  // Define CSV headers
  const headers = [
    "Date",
    "Description",
    "Merchant",
    "Amount",
    "Currency",
    "Category",
    "Account",
    "Type",
    "Status",
  ];

  // Build CSV rows
  const rows = transactions.map((tx) => {
    const date = new Date(tx.bookedAt).toISOString().split("T")[0];
    const description = escapeCsvField(tx.description || "");
    const merchant = escapeCsvField(tx.merchant || "");
    const amount = tx.amount.toFixed(2);
    const currency = tx.currency || "EUR";
    const category = escapeCsvField(tx.category?.name || "Uncategorized");
    const account = escapeCsvField(tx.account?.name || "Unknown");
    const type = tx.transactionType || (tx.amount < 0 ? "debit" : "credit");
    const status = tx.pending ? "Pending" : "Completed";

    return [date, description, merchant, amount, currency, category, account, type, status];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const defaultFilename = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
  link.setAttribute("href", url);
  link.setAttribute("download", filename || defaultFilename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escape a field for CSV format
 * Wraps in quotes if contains comma, quote, or newline
 */
function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
