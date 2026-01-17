import { Header } from "@/components/layout/header";
import { CashBalanceCard } from "@/components/charts/cash-balance-card";
import { TransactionSummaryChart } from "@/components/charts/transaction-summary-chart";
import { getTotalBalance, getTransactionSummary } from "@/lib/actions/analytics";

export default async function HomePage() {
  const [balanceData, transactionSummary] = await Promise.all([
    getTotalBalance(),
    getTransactionSummary(30),
  ]);

  return (
    <>
      <Header title="Dashboard" />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CashBalanceCard
            balance={balanceData.total}
            currency={balanceData.currency}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-1">
          <TransactionSummaryChart data={transactionSummary} />
        </div>
      </div>
    </>
  );
}
