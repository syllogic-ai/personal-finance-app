import { Header } from "@/components/layout/header";
import { RecurringTransactionsClient } from "@/components/recurring-transactions/recurring-transactions-client";
import { getRecurringTransactions } from "@/lib/actions/recurring-transactions";
import { getUserCategories } from "@/lib/actions/categories";

export default async function RecurringTransactionsPage() {
  const [recurringTransactions, categories] = await Promise.all([
    getRecurringTransactions(),
    getUserCategories(),
  ]);

  return (
    <>
      <Header title="Recurring Transactions" />
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 pt-0">
        <RecurringTransactionsClient
          initialTransactions={recurringTransactions}
          categories={categories}
        />
      </div>
    </>
  );
}
